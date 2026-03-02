// Calldata decoding wrapper -- common ERC-20/DeFi selectors

const KNOWN_SELECTORS: Record<string, { name: string; description: string }> = {
  '0xa9059cbb': { name: 'transfer', description: 'Transfer tokens' },
  '0x095ea7b3': { name: 'approve', description: 'Approve token spending' },
  '0x23b872dd': { name: 'transferFrom', description: 'Transfer tokens from' },
  '0x39509351': { name: 'increaseAllowance', description: 'Increase allowance' },
  '0xa457c2d7': { name: 'decreaseAllowance', description: 'Decrease allowance' },
  '0x3593564c': { name: 'execute', description: 'Uniswap Universal Router' },
  '0x5ae401dc': { name: 'multicall', description: 'Multicall' },
  '0xd0e30db0': { name: 'deposit', description: 'Wrap ETH (WETH)' },
  '0x2e1a7d4d': { name: 'withdraw', description: 'Unwrap ETH (WETH)' },
};

export interface DecodedCalldata {
  name?: string;
  description?: string;
  raw: string;
}

export function decodeCalldata(data: string): DecodedCalldata {
  if (!data || data === '0x' || data.length < 10) {
    return { name: 'ETH Transfer', description: 'Send ETH', raw: data || '0x' };
  }
  const selector = data.slice(0, 10).toLowerCase();
  const known = KNOWN_SELECTORS[selector];
  if (known) {
    return { ...known, raw: data };
  }
  return { raw: data };
}
