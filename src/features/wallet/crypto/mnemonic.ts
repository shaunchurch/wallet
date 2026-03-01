import {
  generateMnemonic as _generateMnemonic,
  mnemonicToSeed as _mnemonicToSeed,
  validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

/**
 * Generate a BIP-39 mnemonic phrase.
 * @param strength 128 = 12 words (default), 256 = 24 words
 */
export function generateMnemonic(strength: 128 | 256 = 128): string {
  return _generateMnemonic(wordlist, strength);
}

/**
 * Validate a BIP-39 mnemonic phrase.
 * Returns true if valid, false otherwise.
 */
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic, wordlist);
}

/**
 * Convert a BIP-39 mnemonic to a 64-byte seed.
 * @throws if mnemonic is invalid
 */
export async function mnemonicToSeed(mnemonic: string): Promise<Uint8Array> {
  if (!isValidMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic');
  }
  return _mnemonicToSeed(mnemonic);
}
