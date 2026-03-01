// EIP-1559 Type 2 transaction construction and signing via micro-eth-signer

import { addr, Transaction } from 'micro-eth-signer';

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
}): string {
  const tx = Transaction.prepare({
    to: params.to,
    value: params.value,
    nonce: params.nonce,
    gasLimit: params.gasLimit,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    chainId: BigInt(params.chainId),
  });
  const signed = tx.signBy(params.privateKey);
  return signed.toHex(); // includes 0x prefix
}

/**
 * Calculate maximum sendable ETH after gas deduction.
 * Returns 0n if balance insufficient for gas.
 */
export function calculateMaxSend(
  balanceWei: bigint,
  gasLimit: bigint,
  maxFeePerGas: bigint,
): bigint {
  const maxGasCost = gasLimit * maxFeePerGas;
  const maxSend = balanceWei - maxGasCost;
  return maxSend > 0n ? maxSend : 0n;
}

/**
 * Format wei to human-readable ETH string.
 * Up to 4 significant decimal places, trailing zeros trimmed.
 */
export function formatEth(wei: bigint): string {
  if (wei === 0n) return '0';

  const negative = wei < 0n;
  const abs = negative ? -wei : wei;

  // Split into integer and fractional parts using bigint math (no floats)
  const ETH = 1_000_000_000_000_000_000n; // 10^18
  const integerPart = abs / ETH;
  const fractionalWei = abs % ETH;

  if (fractionalWei === 0n) {
    return `${negative ? '-' : ''}${integerPart.toString()}`;
  }

  // Convert fractional part to 18-digit string, zero-padded
  const fracStr = fractionalWei.toString().padStart(18, '0');

  // Find first non-zero digit, then show up to 4 significant digits
  const firstNonZero = fracStr.search(/[1-9]/);
  if (firstNonZero === -1) {
    return `${negative ? '-' : ''}${integerPart.toString()}`;
  }

  const significantEnd = Math.min(firstNonZero + 4, 18);
  const trimmed = fracStr.slice(0, significantEnd).replace(/0+$/, '');

  return `${negative ? '-' : ''}${integerPart.toString()}.${trimmed}`;
}

/**
 * Format a number as USD using Intl.NumberFormat.
 */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parse user ETH input string to wei bigint.
 * Handles decimals precisely without floating point.
 */
export function parseEthToWei(eth: string): bigint {
  const trimmed = eth.trim();
  if (trimmed === '' || trimmed === '.') return 0n;

  const parts = trimmed.split('.');
  if (parts.length > 2) throw new Error('Invalid ETH amount');

  const integerStr = parts[0] ?? '0';
  const decimalStr = (parts[1] ?? '').slice(0, 18); // max 18 decimal places

  // Pad or truncate decimal to exactly 18 digits
  const paddedDecimal = decimalStr.padEnd(18, '0');

  const integerWei = BigInt(integerStr) * 1_000_000_000_000_000_000n;
  const fractionalWei = BigInt(paddedDecimal);

  return integerWei + fractionalWei;
}

/**
 * Validate an Ethereum address.
 */
export function validateAddress(input: string): { valid: boolean; error?: string } {
  if (!input.startsWith('0x')) return { valid: false, error: 'Address must start with 0x' };
  if (input.length !== 42) return { valid: false, error: 'Address must be 42 characters' };
  if (!addr.isValid(input)) return { valid: false, error: 'Invalid address checksum' };
  return { valid: true };
}
