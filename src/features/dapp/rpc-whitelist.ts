// RPC method whitelist -- classifies dapp-callable methods
// direct: proxy to RPC or handle locally, no user approval
// approval: requires user confirmation (implemented in plan 05-02)
// blocked: rejected unless explicitly enabled in settings

export type RpcMethodCategory = 'direct' | 'approval' | 'blocked';

export const RPC_WHITELIST: Record<string, RpcMethodCategory> = {
  // Direct -- no approval needed, proxy to RPC
  eth_chainId: 'direct',
  eth_accounts: 'direct',
  net_version: 'direct',
  eth_blockNumber: 'direct',
  eth_getBalance: 'direct',
  eth_getCode: 'direct',
  eth_getTransactionCount: 'direct',
  eth_getStorageAt: 'direct',
  eth_call: 'direct',
  eth_estimateGas: 'direct',
  eth_gasPrice: 'direct',
  eth_getBlockByNumber: 'direct',
  eth_getBlockByHash: 'direct',
  eth_getTransactionByHash: 'direct',
  eth_getTransactionReceipt: 'direct',
  eth_getLogs: 'direct',
  eth_maxPriorityFeePerGas: 'direct',
  eth_feeHistory: 'direct',
  web3_clientVersion: 'direct',
  wallet_switchEthereumChain: 'direct',

  // Approval required
  eth_requestAccounts: 'approval',
  eth_sendTransaction: 'approval',
  personal_sign: 'approval',
  eth_signTypedData_v4: 'approval',

  // Blocked
  eth_sign: 'blocked',
};

/** Returns category for a known method, or null for unlisted methods. */
export function getMethodCategory(method: string): RpcMethodCategory | null {
  return (RPC_WHITELIST[method] as RpcMethodCategory | undefined) ?? null;
}
