// Vault blob stored in chrome.storage.local
export interface VaultBlob {
  version: 1;
  kdf: {
    algorithm: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number; // 600_000+
    salt: string; // hex-encoded, 16 bytes random
  };
  cipher: {
    algorithm: 'AES-256-GCM';
    iv: string; // hex-encoded, 12 bytes random
  };
  data: string; // hex-encoded ciphertext (includes GCM auth tag)
}

// Plaintext stored inside encrypted vault
export interface VaultPlaintext {
  mnemonic: string; // BIP-39 mnemonic phrase
  createdAt: number; // unix timestamp ms
}

// A derived account (public info only -- safe to pass outside background)
export interface DerivedAccount {
  index: number; // BIP-44 address_index
  address: string; // EIP-55 checksummed 0x address
  path: string; // full derivation path
}

// Internal key pair (NEVER leaves background service worker)
export interface KeyPair {
  privateKey: Uint8Array; // 32 bytes
  address: string; // EIP-55 checksummed
  path: string; // derivation path
}

// Lockout state -- persisted to chrome.storage.session
export interface LockoutState {
  failedAttempts: number;
  lockedUntil: number; // timestamp ms, 0 = not locked
}

// Lockout manager returned by createLockoutManager()
export interface LockoutManager {
  checkLockout(): { locked: boolean; remainingMs: number };
  recordFailure(): void;
  reset(): void;
  serialize(): LockoutState;
}

// Message types -- popup sends to background
export type WalletMessage =
  | { type: 'wallet:create'; password: string; strength?: 128 | 256 }
  | {
      type: 'wallet:confirmSeedPhrase';
      wordIndices: Array<{ position: number; word: string }>;
    } // SEC-03: proof-of-confirmation
  | { type: 'wallet:import'; password: string; mnemonic: string }
  | { type: 'wallet:unlock'; password: string }
  | { type: 'wallet:lock' }
  | { type: 'wallet:getAccounts' }
  | { type: 'wallet:deriveAccount'; index: number };

// Response types -- background sends back
export type WalletResponse =
  | { type: 'wallet:created'; address: string; mnemonic: string }
  | { type: 'wallet:confirmed'; address: string } // SEC-03: seed confirmed, vault persisted
  | { type: 'wallet:imported'; address: string }
  | { type: 'wallet:unlocked'; address: string }
  | { type: 'wallet:locked' }
  | { type: 'wallet:accounts'; accounts: DerivedAccount[] }
  | { type: 'wallet:derived'; account: DerivedAccount }
  | { type: 'wallet:error'; error: string };
