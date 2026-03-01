import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/**
 * Derive an EIP-55 checksummed Ethereum address from a secp256k1 private key.
 *
 * Pipeline: privkey -> uncompressed pubkey (65 bytes) -> drop 04 prefix ->
 * keccak256 -> last 20 bytes -> EIP-55 checksum
 */
export function privateKeyToAddress(privateKey: Uint8Array): string {
  // CRITICAL: false = uncompressed 65-byte key. Default compressed gives wrong addresses.
  const pubKey = secp256k1.getPublicKey(privateKey, false);
  const hash = keccak_256(pubKey.slice(1)); // drop 04 prefix
  const addressBytes = hash.slice(-20);
  return toChecksumAddress(bytesToHex(addressBytes));
}

/**
 * EIP-55 mixed-case checksum encoding.
 * @param hex 40-char hex string WITHOUT 0x prefix
 */
export function toChecksumAddress(hex: string): string {
  const lower = hex.toLowerCase();
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(lower)));
  let checksummed = '0x';
  for (let i = 0; i < 40; i++) {
    const h = hash[i] as string;
    const c = lower[i] as string;
    checksummed += Number.parseInt(h, 16) >= 8 ? c.toUpperCase() : c;
  }
  return checksummed;
}
