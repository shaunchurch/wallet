import { mnemonicToSeed } from '@scure/bip39';
import { describe, expect, it } from 'vitest';
import { deriveAccount, deriveAccounts } from '@/features/wallet/crypto/hd';

// Known test mnemonic: "abandon abandon ... about" (BIP-39 test vector #0)
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Expected Ethereum address at m/44'/60'/0'/0/0 for the above mnemonic
// Cross-referenced with multiple implementations (ethers.js, MEW, iancoleman.io)
const EXPECTED_ADDRESS_0 = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';

describe('BIP-44 HD Key Derivation', () => {
  let seed: Uint8Array;

  // Derive seed once for all tests
  it('derives seed from test mnemonic', async () => {
    seed = await mnemonicToSeed(TEST_MNEMONIC);
    expect(seed).toHaveLength(64);
  });

  it("derives correct address at m/44'/60'/0'/0/0", () => {
    const account = deriveAccount(seed, 0);
    expect(account.address).toBe(EXPECTED_ADDRESS_0);
    expect(account.path).toBe("m/44'/60'/0'/0/0");
    expect(account.privateKey).toHaveLength(32);
  });

  it('derives different addresses for different indices', () => {
    const a0 = deriveAccount(seed, 0);
    const a1 = deriveAccount(seed, 1);
    const a2 = deriveAccount(seed, 2);

    expect(a0.address).not.toBe(a1.address);
    expect(a1.address).not.toBe(a2.address);
    expect(a0.address).not.toBe(a2.address);
  });

  it('all addresses are valid 42-char checksummed hex', () => {
    for (let i = 0; i < 5; i++) {
      const account = deriveAccount(seed, i);
      expect(account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(account.address).toHaveLength(42);
    }
  });

  it('derivation is deterministic (same seed + index = same result)', () => {
    const first = deriveAccount(seed, 0);
    const second = deriveAccount(seed, 0);

    expect(first.address).toBe(second.address);
    expect(first.path).toBe(second.path);
    expect(first.privateKey).toEqual(second.privateKey);
  });

  it('uses correct BIP-44 path format', () => {
    const a0 = deriveAccount(seed, 0);
    const a5 = deriveAccount(seed, 5);

    expect(a0.path).toBe("m/44'/60'/0'/0/0");
    expect(a5.path).toBe("m/44'/60'/0'/0/5");
  });

  describe('deriveAccounts (batch)', () => {
    it('derives correct number of accounts', () => {
      const accounts = deriveAccounts(seed, 3);
      expect(accounts).toHaveLength(3);
    });

    it('batch matches individual derivation', () => {
      const batch = deriveAccounts(seed, 3);
      for (let i = 0; i < 3; i++) {
        const single = deriveAccount(seed, i);
        const b = batch[i] as (typeof batch)[number];
        expect(b.address).toBe(single.address);
        expect(b.path).toBe(single.path);
      }
    });

    it('first account matches expected address', () => {
      const accounts = deriveAccounts(seed, 1);
      const first = accounts[0] as (typeof accounts)[number];
      expect(first.address).toBe(EXPECTED_ADDRESS_0);
    });
  });
});
