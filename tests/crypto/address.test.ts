import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import { privateKeyToAddress, toChecksumAddress } from '@/features/wallet/crypto/address';

// EIP-55 test cases from the EIP spec
// https://eips.ethereum.org/EIPS/eip-55
const EIP55_VECTORS = [
  // All caps
  '0x52908400098527886E0F7030069857D2E4169EE7',
  '0x8617E340B3D01FA5F11F306F4090FD50E238070D',
  // All lower
  '0xde709f2102306220921060314715629080e2fb77',
  '0x27b1fdb04752bbc536007a920d24acb045561c26',
  // Mixed case
  '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
  '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
  '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
];

// Known private key -> address pairs for verification
// Source: widely published test vectors
const PRIVKEY_VECTORS: Array<[string, string]> = [
  [
    '4c0883a69102937d6231471b5dbb6204fe512961708279f8b9bb22e0f2d3c7c4',
    '0xc04Ab5c253d8077420C2b6eABED474BB39d3F686',
  ],
  // secp256k1 generator point private key (well-known test vector)
  [
    '0000000000000000000000000000000000000000000000000000000000000001',
    '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf',
  ],
];

describe('EIP-55 Checksum Address', () => {
  describe('toChecksumAddress', () => {
    for (const expected of EIP55_VECTORS) {
      it(`correctly checksums ${expected}`, () => {
        // Strip 0x, feed lowercase hex
        const hex = expected.slice(2).toLowerCase();
        const result = toChecksumAddress(hex);
        expect(result).toBe(expected);
      });
    }

    it('all results are 42 chars (0x + 40 hex)', () => {
      for (const addr of EIP55_VECTORS) {
        const result = toChecksumAddress(addr.slice(2).toLowerCase());
        expect(result).toHaveLength(42);
        expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
    });

    it('is idempotent (checksumming a checksummed address)', () => {
      for (const addr of EIP55_VECTORS) {
        const hex = addr.slice(2).toLowerCase();
        const first = toChecksumAddress(hex);
        const second = toChecksumAddress(first.slice(2).toLowerCase());
        expect(first).toBe(second);
      }
    });
  });

  describe('privateKeyToAddress', () => {
    for (const [privKeyHex, expectedAddress] of PRIVKEY_VECTORS) {
      it(`derives correct address from privkey ${privKeyHex.slice(0, 8)}...`, () => {
        const privKey = hexToBytes(privKeyHex);
        const address = privateKeyToAddress(privKey);
        expect(address).toBe(expectedAddress);
      });
    }

    it('all addresses are 42 chars', () => {
      for (const [privKeyHex] of PRIVKEY_VECTORS) {
        const address = privateKeyToAddress(hexToBytes(privKeyHex));
        expect(address).toHaveLength(42);
        expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
    });
  });
});
