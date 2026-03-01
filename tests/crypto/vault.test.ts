import { describe, expect, it } from 'vitest';
import { createLockoutManager, decryptVault, encryptVault } from '@/features/wallet/crypto/vault';
import type { VaultPlaintext } from '@/features/wallet/types';

const SAMPLE_PLAINTEXT: VaultPlaintext = {
  mnemonic:
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  createdAt: 1234567890,
};

describe('vault encrypt/decrypt round-trip', () => {
  const passwords = [
    ['empty string', ''],
    ['ASCII basic', 'password123'],
    ['special characters', 'P@$$w0rd!#%^&*()'],
    ['1000+ chars', 'a'.repeat(1000)],
    ['emoji', '\u{1F510}\u{1F5DD}\uFE0F\u{1F4B0}'],
    ['CJK characters', '\u5BC6\u7801\u6D4B\u8BD5'],
    ['accented characters', '\u00D1o\u00F1o'],
    ['Cyrillic', '\u043F\u0430\u0440\u043E\u043B\u044C'],
    ['null byte', 'null\x00byte'],
    ['single space', ' '],
  ] as const;

  for (const [label, password] of passwords) {
    it(`round-trips with ${label} password`, async () => {
      const blob = await encryptVault(SAMPLE_PLAINTEXT, password);
      const decrypted = await decryptVault(blob, password);
      expect(decrypted).toEqual(SAMPLE_PLAINTEXT);
    });
  }
});

describe('vault wrong password', () => {
  it('throws on wrong password', async () => {
    const blob = await encryptVault(SAMPLE_PLAINTEXT, 'correct');
    await expect(decryptVault(blob, 'wrong')).rejects.toThrow('Incorrect password');
  });

  it('throws decrypting with empty when encrypted with non-empty', async () => {
    const blob = await encryptVault(SAMPLE_PLAINTEXT, 'correct');
    await expect(decryptVault(blob, '')).rejects.toThrow('Incorrect password');
  });

  it('throws decrypting with non-empty when encrypted with empty', async () => {
    const blob = await encryptVault(SAMPLE_PLAINTEXT, '');
    await expect(decryptVault(blob, 'x')).rejects.toThrow('Incorrect password');
  });
});

describe('vault blob structure', () => {
  it('has correct version and params', async () => {
    const blob = await encryptVault(SAMPLE_PLAINTEXT, 'test');
    expect(blob.version).toBe(1);
    expect(blob.kdf.algorithm).toBe('PBKDF2');
    expect(blob.kdf.hash).toBe('SHA-256');
    expect(blob.kdf.iterations).toBeGreaterThanOrEqual(600_000);
    expect(blob.kdf.salt).toMatch(/^[0-9a-f]{32}$/); // 16 bytes = 32 hex chars
    expect(blob.cipher.algorithm).toBe('AES-256-GCM');
    expect(blob.cipher.iv).toMatch(/^[0-9a-f]{24}$/); // 12 bytes = 24 hex chars
    expect(blob.data).toMatch(/^[0-9a-f]+$/);
    expect(blob.data.length).toBeGreaterThan(0);
  });
});

describe('vault unique salt and IV', () => {
  it('generates different salt and IV for same plaintext and password', async () => {
    const blob1 = await encryptVault(SAMPLE_PLAINTEXT, 'same-password');
    const blob2 = await encryptVault(SAMPLE_PLAINTEXT, 'same-password');
    expect(blob1.kdf.salt).not.toBe(blob2.kdf.salt);
    expect(blob1.cipher.iv).not.toBe(blob2.cipher.iv);
    // Both still decrypt correctly
    const d1 = await decryptVault(blob1, 'same-password');
    const d2 = await decryptVault(blob2, 'same-password');
    expect(d1).toEqual(SAMPLE_PLAINTEXT);
    expect(d2).toEqual(SAMPLE_PLAINTEXT);
  });
});

describe('lockout manager', () => {
  it('starts unlocked', () => {
    const mgr = createLockoutManager();
    expect(mgr.checkLockout().locked).toBe(false);
  });

  it('stays unlocked after 1-2 failures', () => {
    const mgr = createLockoutManager();
    mgr.recordFailure();
    expect(mgr.checkLockout().locked).toBe(false);
    mgr.recordFailure();
    expect(mgr.checkLockout().locked).toBe(false);
  });

  it('locks after 3rd failure with ~5s delay', () => {
    const mgr = createLockoutManager();
    mgr.recordFailure();
    mgr.recordFailure();
    mgr.recordFailure();
    const status = mgr.checkLockout();
    expect(status.locked).toBe(true);
    expect(status.remainingMs).toBeGreaterThan(0);
    expect(status.remainingMs).toBeLessThanOrEqual(5000);
  });

  it('reset clears lockout', () => {
    const mgr = createLockoutManager();
    mgr.recordFailure();
    mgr.recordFailure();
    mgr.recordFailure();
    expect(mgr.checkLockout().locked).toBe(true);
    mgr.reset();
    expect(mgr.checkLockout().locked).toBe(false);
  });

  it('serialize/restore round-trips state', () => {
    const mgr = createLockoutManager();
    mgr.recordFailure();
    mgr.recordFailure();
    mgr.recordFailure();
    const saved = mgr.serialize();
    const restored = createLockoutManager(saved);
    const status = restored.checkLockout();
    expect(status.locked).toBe(true);
    expect(status.remainingMs).toBeGreaterThan(0);
  });
});
