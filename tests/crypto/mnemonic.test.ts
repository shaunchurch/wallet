import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import {
  generateMnemonic,
  isValidMnemonic,
  mnemonicToSeed,
} from '@/features/wallet/crypto/mnemonic';

// BIP-39 test vectors (English) validated against Trezor reference implementation
// Format: [mnemonic, seed_with_TREZOR_passphrase]
// Passphrase: "TREZOR" (appended to "mnemonic" salt per BIP-39 spec)
// Verified via manual PBKDF2-HMAC-SHA512 with 2048 iterations
const TEST_VECTORS: Array<[string, string]> = [
  // 128-bit (12-word)
  [
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04',
  ],
  [
    'legal winner thank year wave sausage worth useful legal winner thank yellow',
    '2e8905819b8723fe2c1d161860e5ee1830318dbf49a83bd451cfb8440c28bd6fa457fe1296106559a3c80937a1c1069be3a3a5bd381ee6260e8d9739fce1f607',
  ],
  [
    'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
    'd71de856f81a8acc65e6fc851a38d4d7ec216fd0796d0a6827a3ad6ed5511a30fa280f12eb2e47ed2ac03b5c462a0358d18d69fe4f985ec81778c1b370b652a8',
  ],
  [
    'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
    'ac27495480225222079d7be181583751e86f571027b0497b5b5d11218e0a8a13332572917f0f8e5a589620c6f15b11c61dee327651a14c34e18231052e48c069',
  ],
  // 256-bit (24-word)
  [
    'void come effort suffer camp survey warrior heavy shoot primary clutch crush open amazing screen patrol group space point ten exist slush involve unfold',
    '01f5bced59dec48e362f2c45b5de68b9fd6c92c6634f44d6d40aab69056506f0e35524a518034ddc1192e1dacd32c1ed3eaa3c3b131c88ed8e7e54c49a5d0998',
  ],
  [
    'all hour make first leader extend hole alien behind guard gospel lava path output census museum junior mass reopen famous sing advance salt reform',
    '26e975ec644423f4a4c4f4215ef09b4bd7ef924e85d1d17c4cf3f136c2863cf6df0a475045652c57eb5fb41513ca2a2d67722b77e954b4b3fc11f7590449191d',
  ],
];

// Seeds with empty passphrase (what our mnemonicToSeed returns)
const EMPTY_PASSPHRASE_SEEDS: Array<[string, string]> = [
  [
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4',
  ],
  [
    'legal winner thank year wave sausage worth useful legal winner thank yellow',
    '878386efb78845b3355bd15ea4d39ef97d179cb712b77d5c12b6be415fffeffe5f377ba02bf3f8544ab800b955e51fbff09828f682052a20faa6addbbddfb096',
  ],
  [
    'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
    'b6a6d8921942dd9806607ebc2750416b289adea669198769f2e15ed926c3aa92bf88ece232317b4ea463e84b0fcd3b53577812ee449ccc448eb45e6f544e25b6',
  ],
];

describe('BIP-39 Mnemonic', () => {
  describe('generateMnemonic', () => {
    it('produces 12 words by default', () => {
      const words = generateMnemonic().split(' ');
      expect(words).toHaveLength(12);
    });

    it('produces 24 words with strength=256', () => {
      const words = generateMnemonic(256).split(' ');
      expect(words).toHaveLength(24);
    });

    it('produces valid mnemonics', () => {
      expect(isValidMnemonic(generateMnemonic())).toBe(true);
      expect(isValidMnemonic(generateMnemonic(256))).toBe(true);
    });

    it('produces different mnemonics each call', () => {
      expect(generateMnemonic()).not.toBe(generateMnemonic());
    });
  });

  describe('isValidMnemonic', () => {
    it('accepts valid mnemonics from test vectors', () => {
      for (const [mnemonic] of TEST_VECTORS) {
        expect(isValidMnemonic(mnemonic)).toBe(true);
      }
    });

    it('rejects garbage strings', () => {
      expect(isValidMnemonic('hello world foo bar')).toBe(false);
      expect(isValidMnemonic('')).toBe(false);
      expect(isValidMnemonic('not a valid mnemonic at all')).toBe(false);
    });

    it('rejects wrong word count', () => {
      expect(isValidMnemonic('abandon abandon abandon')).toBe(false);
      expect(isValidMnemonic('abandon')).toBe(false);
    });

    it('rejects wrong checksum', () => {
      // 12 valid words but last word breaks checksum
      expect(
        isValidMnemonic(
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon',
        ),
      ).toBe(false);
    });
  });

  describe('mnemonicToSeed', () => {
    for (const [mnemonic, expectedSeed] of EMPTY_PASSPHRASE_SEEDS) {
      it(`produces correct seed for "${mnemonic.split(' ').slice(0, 3).join(' ')}..."`, async () => {
        const seed = await mnemonicToSeed(mnemonic);
        expect(bytesToHex(seed)).toBe(expectedSeed);
      });
    }

    it('produces 64-byte Uint8Array', async () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const seed = await mnemonicToSeed(mnemonic);
      expect(seed).toHaveLength(64);
      expect(seed).toBeInstanceOf(Uint8Array);
    });

    it('throws on invalid mnemonic', async () => {
      await expect(mnemonicToSeed('garbage words here')).rejects.toThrow('Invalid mnemonic');
    });

    it('does not echo mnemonic in error message', async () => {
      const badMnemonic = 'secret words that should not leak';
      try {
        await mnemonicToSeed(badMnemonic);
      } catch (e) {
        expect((e as Error).message).not.toContain('secret');
        expect((e as Error).message).toBe('Invalid mnemonic');
      }
    });
  });

  describe('BIP-39 PBKDF2 seed derivation (Trezor vector verification)', () => {
    // Verify the BIP-39 PBKDF2 pipeline directly:
    // PBKDF2(mnemonic_NFKD, "mnemonic" + passphrase, 2048, 64, SHA-512)
    // This validates our crypto stack produces correct seeds per the BIP-39 spec
    // using the well-known "TREZOR" passphrase vectors.
    for (const [mnemonic, expectedSeed] of TEST_VECTORS) {
      it(`matches Trezor vector for "${mnemonic.split(' ').slice(0, 3).join(' ')}..."`, async () => {
        const enc = new TextEncoder();
        const mnemonicBytes = enc.encode(mnemonic.normalize('NFKD'));
        const salt = enc.encode('mnemonicTREZOR');
        const seed = await pbkdf2Async(sha512, mnemonicBytes, salt, {
          c: 2048,
          dkLen: 64,
        });
        expect(bytesToHex(seed)).toBe(expectedSeed);
      });
    }
  });
});
