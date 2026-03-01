// Pure formatting utilities -- no crypto imports. Safe for popup bundle.

/**
 * Format wei to human-readable ETH string.
 * Up to 4 significant decimal places, trailing zeros trimmed.
 */
export function formatEth(wei: bigint): string {
  if (wei === 0n) return '0';

  const negative = wei < 0n;
  const abs = negative ? -wei : wei;

  const ETH = 1_000_000_000_000_000_000n;
  const integerPart = abs / ETH;
  const fractionalWei = abs % ETH;

  if (fractionalWei === 0n) {
    return `${negative ? '-' : ''}${integerPart.toString()}`;
  }

  const fracStr = fractionalWei.toString().padStart(18, '0');
  const firstNonZero = fracStr.search(/[1-9]/);
  if (firstNonZero === -1) {
    return `${negative ? '-' : ''}${integerPart.toString()}`;
  }

  const significantEnd = Math.min(firstNonZero + 4, 18);
  const trimmed = fracStr.slice(0, significantEnd).replace(/0+$/, '');

  return `${negative ? '-' : ''}${integerPart.toString()}.${trimmed}`;
}

/**
 * Format a number as USD.
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
 */
export function parseEthToWei(eth: string): bigint {
  const trimmed = eth.trim();
  if (trimmed === '' || trimmed === '.') return 0n;

  const parts = trimmed.split('.');
  if (parts.length > 2) throw new Error('Invalid ETH amount');

  const integerStr = parts[0] ?? '0';
  const decimalStr = (parts[1] ?? '').slice(0, 18);
  const paddedDecimal = decimalStr.padEnd(18, '0');

  const integerWei = BigInt(integerStr) * 1_000_000_000_000_000_000n;
  const fractionalWei = BigInt(paddedDecimal);

  return integerWei + fractionalWei;
}

/**
 * Calculate maximum sendable ETH after gas deduction.
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
