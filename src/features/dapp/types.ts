// Dapp provider types -- SEPARATE from WalletMessage/WalletResponse
// These types never carry seed, mnemonic, privateKey, or any key material.

// ---------------------------------------------------------------------------
// EIP-1193 RPC error codes
// ---------------------------------------------------------------------------

export const RPC_ERRORS = {
  USER_REJECTED: { code: 4001, message: 'User rejected the request' },
  UNAUTHORIZED: { code: 4100, message: 'Unauthorized' },
  UNSUPPORTED: { code: 4200, message: 'Unsupported method' },
  DISCONNECTED: { code: 4900, message: 'Disconnected' },
  CHAIN_NOT_ADDED: { code: 4902, message: 'Chain not added' },
} as const;

// ---------------------------------------------------------------------------
// Connected site persistence
// ---------------------------------------------------------------------------

export interface ConnectedSite {
  origin: string;
  favicon: string;
  name: string;
  accounts: string[]; // checksummed addresses shared with this site
  connectedAt: number; // timestamp ms
}

// ---------------------------------------------------------------------------
// Dapp <-> Background message types
// ---------------------------------------------------------------------------

/** Content script -> background: RPC request from dapp */
export interface DappRpcRequest {
  type: 'dapp:rpc';
  id: number;
  method: string;
  params?: unknown[];
  origin: string; // attached by content script, NOT trusted from page
  favicon?: string;
  title?: string;
}

/** Background -> content script: RPC response */
export interface DappRpcResponse {
  result?: unknown;
  error?: { code: number; message: string };
}

/** Background -> content script: push event (accountsChanged, chainChanged, etc.) */
export interface DappEvent {
  type: 'dapp:event';
  event: 'accountsChanged' | 'chainChanged' | 'connect' | 'disconnect';
  data: unknown;
}
