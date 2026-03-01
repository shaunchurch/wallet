import { HDKey } from '@scure/bip32';
import type { KeyPair } from '../types.js';
import { privateKeyToAddress } from './address.js';

const ETH_BIP44_PREFIX = "m/44'/60'/0'/0";

/**
 * Derive a single account from a BIP-39 seed at BIP-44 path m/44'/60'/0'/0/{index}.
 */
export function deriveAccount(seed: Uint8Array, index: number): KeyPair {
  const path = `${ETH_BIP44_PREFIX}/${index}`;
  const master = HDKey.fromMasterSeed(seed);
  const child = master.derive(path);

  if (!child.privateKey) {
    throw new Error('Derivation produced null private key');
  }

  return {
    privateKey: child.privateKey,
    address: privateKeyToAddress(child.privateKey),
    path,
  };
}

/**
 * Derive multiple sequential accounts (indices 0..count-1).
 */
export function deriveAccounts(seed: Uint8Array, count: number): KeyPair[] {
  const accounts: KeyPair[] = [];
  for (let i = 0; i < count; i++) {
    accounts.push(deriveAccount(seed, i));
  }
  return accounts;
}
