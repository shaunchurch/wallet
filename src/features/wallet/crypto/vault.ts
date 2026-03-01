import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import type {
  LockoutManager,
  LockoutState,
  VaultBlob,
  VaultPlaintext,
} from '../types';

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** Lockout delays in ms indexed by (failedAttempts - 3). */
const LOCKOUT_DELAYS = [5_000, 15_000, 30_000] as const;

/**
 * Derive an AES-256-GCM CryptoKey from password + salt via PBKDF2.
 * Password is NFKD-normalized before encoding (handles unicode edge cases).
 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(password.normalize('NFKD'));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoded,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt vault plaintext with a user password.
 * Generates fresh random salt and IV on every call (never reuses).
 */
export async function encryptVault(
  plaintext: VaultPlaintext,
  password: string,
): Promise<VaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const encoded = new TextEncoder().encode(JSON.stringify(plaintext));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );
  return {
    version: 1,
    kdf: {
      algorithm: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToHex(salt),
    },
    cipher: {
      algorithm: 'AES-256-GCM',
      iv: bytesToHex(iv),
    },
    data: bytesToHex(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypt a vault blob with the user password.
 * Uses blob.kdf.iterations (not hardcoded constant) to support future migration.
 * @throws Error('Incorrect password') on wrong password -- never exposes internals.
 * @throws Error('Unsupported vault version: N') on unknown version.
 */
export async function decryptVault(
  blob: VaultBlob,
  password: string,
): Promise<VaultPlaintext> {
  if (blob.version !== 1) {
    throw new Error(`Unsupported vault version: ${blob.version}`);
  }
  const salt = hexToBytes(blob.kdf.salt);
  const iv = hexToBytes(blob.cipher.iv);
  const ciphertext = hexToBytes(blob.data);
  const key = await deriveKey(password, salt, blob.kdf.iterations);
  let decrypted: ArrayBuffer;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
  } catch {
    throw new Error('Incorrect password');
  }
  const json = new TextDecoder().decode(decrypted);
  return JSON.parse(json) as VaultPlaintext;
}

/**
 * Create a lockout manager for tracking failed password attempts.
 * Pass saved state to restore from persistence (survives SW termination).
 */
export function createLockoutManager(state?: LockoutState): LockoutManager {
  let failedAttempts = state?.failedAttempts ?? 0;
  let lockedUntil = state?.lockedUntil ?? 0;

  return {
    checkLockout(): { locked: boolean; remainingMs: number } {
      const remaining = lockedUntil - Date.now();
      if (remaining > 0) {
        return { locked: true, remainingMs: remaining };
      }
      return { locked: false, remainingMs: 0 };
    },

    recordFailure(): void {
      failedAttempts++;
      if (failedAttempts >= 3) {
        const delayIndex = Math.min(
          failedAttempts - 3,
          LOCKOUT_DELAYS.length - 1,
        );
        const delay = LOCKOUT_DELAYS[delayIndex] as number;
        lockedUntil = Date.now() + delay;
      }
    },

    reset(): void {
      failedAttempts = 0;
      lockedUntil = 0;
    },

    serialize(): LockoutState {
      return { failedAttempts, lockedUntil };
    },
  };
}
