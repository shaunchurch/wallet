// TEST-04: Gas estimation floor enforcement
// Verifies 20% buffer applied before 60k floor check

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/wallet/rpc/provider', () => ({
  rpcCall: vi.fn(),
  NETWORKS: {
    mainnet: { rpcUrl: '', chainId: 4326, explorerUrl: '' },
    testnet: { rpcUrl: '', chainId: 6343, explorerUrl: '' },
  },
}));

import { rpcCall } from '@/features/wallet/rpc/provider';
import { GAS_FLOOR, estimateGas } from '@/features/wallet/rpc/gas';

const FROM = '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf';
const TO = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

describe('Gas Estimation Floor Enforcement', () => {
  it('GAS_FLOOR is 60,000', () => {
    expect(GAS_FLOOR).toBe(60_000n);
  });

  it('21000 estimate -> 25200 after buffer -> below floor -> returns 60000', async () => {
    vi.mocked(rpcCall).mockResolvedValueOnce('0x5208'); // 21000
    const gas = await estimateGas('testnet', FROM, TO, 1n);
    expect(gas).toBe(60_000n);
    expect(gas >= GAS_FLOOR).toBe(true);
  });

  it('50000 estimate -> 60000 after buffer -> equals floor -> returns 60000', async () => {
    vi.mocked(rpcCall).mockResolvedValueOnce('0xc350'); // 50000
    const gas = await estimateGas('testnet', FROM, TO, 1n);
    expect(gas).toBe(60_000n);
    expect(gas >= GAS_FLOOR).toBe(true);
  });

  it('100000 estimate -> 120000 after buffer -> above floor -> returns 120000', async () => {
    vi.mocked(rpcCall).mockResolvedValueOnce('0x186a0'); // 100000
    const gas = await estimateGas('testnet', FROM, TO, 1n);
    expect(gas).toBe(120_000n);
    expect(gas >= GAS_FLOOR).toBe(true);
  });

  it('0 estimate -> returns 60000 (floor)', async () => {
    vi.mocked(rpcCall).mockResolvedValueOnce('0x0');
    const gas = await estimateGas('testnet', FROM, TO, 0n);
    expect(gas).toBe(60_000n);
    expect(gas >= GAS_FLOOR).toBe(true);
  });

  it('no test case ever returns below 60000', async () => {
    const cases = ['0x0', '0x1', '0x5208', '0xc350', '0x186a0', '0x30d40'];
    for (const hex of cases) {
      vi.mocked(rpcCall).mockResolvedValueOnce(hex);
      const gas = await estimateGas('testnet', FROM, TO, 1n);
      expect(gas).toBeGreaterThanOrEqual(60_000n);
    }
  });
});
