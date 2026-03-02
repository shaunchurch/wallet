// EIP-1559 Type 2 transaction construction and signing via micro-eth-signer

import { addr, Transaction } from 'micro-eth-signer';

// Re-export pure formatters for backward compat
export { calculateMaxSend, formatEth, formatUsd, parseEthToWei } from './format';

/**
 * Build and sign an EIP-1559 Type 2 transaction.
 * Returns signed transaction hex string with 0x prefix.
 */
export function buildAndSignTransaction(params: {
  to: string;
  value: bigint;
  nonce: bigint;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  chainId: number;
  privateKey: Uint8Array;
  data?: string | undefined;
}): string {
  const tx = Transaction.prepare({
    to: params.to,
    value: params.value,
    nonce: params.nonce,
    gasLimit: params.gasLimit,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    chainId: BigInt(params.chainId),
    ...(params.data && params.data !== '0x' ? { data: params.data } : {}),
  });
  const signed = tx.signBy(params.privateKey);
  return signed.toHex(); // includes 0x prefix
}

// calculateMaxSend, formatEth, formatUsd, parseEthToWei re-exported from ./format

/**
 * Validate an Ethereum address.
 */
export function validateAddress(input: string): { valid: boolean; error?: string } {
  if (!input.startsWith('0x')) return { valid: false, error: 'Address must start with 0x' };
  if (input.length !== 42) return { valid: false, error: 'Address must be 42 characters' };
  if (!addr.isValid(input)) return { valid: false, error: 'Invalid address checksum' };
  return { valid: true };
}
