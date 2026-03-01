// TEST-06: Sequential nonce correctness
// Verifies nonce parsing from eth_getTransactionCount and sequential behavior

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/wallet/rpc/provider', () => ({
  rpcCall: vi.fn(),
  NETWORKS: {
    mainnet: { rpcUrl: '', chainId: 4326, explorerUrl: '' },
    testnet: { rpcUrl: '', chainId: 6343, explorerUrl: '' },
  },
}));

import { rpcCall } from '@/features/wallet/rpc/provider';

const ADDR = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';

/** Fetch nonce the same way background.ts does: rpcCall + BigInt parse */
async function fetchNonce(
  network: 'mainnet' | 'testnet',
  address: string,
): Promise<bigint> {
  const raw = await rpcCall(network, 'eth_getTransactionCount', [
    address,
    'pending',
  ]);
  return BigInt(raw as string);
}

describe('Sequential Nonce Correctness', () => {
  it('pending count 0x5 -> nonce is 5n', async () => {
    vi.mocked(rpcCall).mockResolvedValueOnce('0x5');
    const nonce = await fetchNonce('testnet', ADDR);
    expect(nonce).toBe(5n);
  });

  it('pending count 0x0 -> nonce is 0n', async () => {
    vi.mocked(rpcCall).mockResolvedValueOnce('0x0');
    const nonce = await fetchNonce('testnet', ADDR);
    expect(nonce).toBe(0n);
  });

  it('sequential txs use sequential nonces', async () => {
    // First tx: pending count is 10
    vi.mocked(rpcCall).mockResolvedValueOnce('0xa');
    const nonce1 = await fetchNonce('testnet', ADDR);

    // After first tx submitted, pending count increments to 11
    vi.mocked(rpcCall).mockResolvedValueOnce('0xb');
    const nonce2 = await fetchNonce('testnet', ADDR);

    expect(nonce1).toBe(10n);
    expect(nonce2).toBe(11n);
    expect(nonce2).toBe(nonce1 + 1n);
  });

  it('large nonce values parse correctly', async () => {
    vi.mocked(rpcCall).mockResolvedValueOnce('0xff'); // 255
    const nonce = await fetchNonce('testnet', ADDR);
    expect(nonce).toBe(255n);
  });

  it('calls eth_getTransactionCount with pending tag', async () => {
    vi.mocked(rpcCall).mockResolvedValueOnce('0x0');
    await fetchNonce('testnet', ADDR);
    expect(rpcCall).toHaveBeenCalledWith(
      'testnet',
      'eth_getTransactionCount',
      [ADDR, 'pending'],
    );
  });
});
