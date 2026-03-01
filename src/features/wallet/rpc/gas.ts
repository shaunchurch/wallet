// Gas estimation with 20% buffer and 60k floor for megaETH

import { rpcCall } from './provider';

export const GAS_FLOOR = 60_000n;

/**
 * Estimate gas for a transaction. Applies 20% buffer BEFORE floor check.
 * megaETH requires minimum 60k gas for all transactions.
 */
export async function estimateGas(
  network: 'mainnet' | 'testnet',
  from: string,
  to: string,
  value: bigint,
): Promise<bigint> {
  const raw = await rpcCall(network, 'eth_estimateGas', [
    { from, to, value: `0x${value.toString(16)}` },
  ]);
  const estimate = BigInt(raw as string);
  const buffered = estimate + estimate / 5n; // 20% buffer
  return buffered > GAS_FLOOR ? buffered : GAS_FLOOR;
}

/**
 * Fetch current fee parameters from the network.
 */
export async function getFeeParams(
  network: 'mainnet' | 'testnet',
): Promise<{ baseFee: bigint; priorityFee: bigint; maxFeePerGas: bigint }> {
  const [baseFeeHex, priorityFeeHex] = await Promise.all([
    rpcCall(network, 'eth_gasPrice', []),
    rpcCall(network, 'eth_maxPriorityFeePerGas', []),
  ]);
  const baseFee = BigInt(baseFeeHex as string);
  const priorityFee = BigInt(priorityFeeHex as string);
  return {
    baseFee,
    priorityFee,
    maxFeePerGas: baseFee + priorityFee,
  };
}
