// JSON-RPC 2.0 fetch wrapper with megaETH network config

export interface NetworkConfig {
  rpcUrl: string;
  chainId: number;
  explorerUrl: string;
}

export const NETWORKS: Record<'mainnet' | 'testnet', NetworkConfig> = {
  mainnet: {
    rpcUrl: 'https://mainnet.megaeth.com/rpc',
    chainId: 4326,
    explorerUrl: 'https://mega.etherscan.io',
  },
  testnet: {
    rpcUrl: 'https://carrot.megaeth.com/rpc',
    chainId: 6343,
    explorerUrl: 'https://megaeth-testnet-v2.blockscout.com',
  },
};

let requestId = 1;

export async function rpcCall(
  network: 'mainnet' | 'testnet',
  method: string,
  params: unknown[],
): Promise<unknown> {
  const { rpcUrl } = NETWORKS[network];
  const id = requestId++;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export function getExplorerTxUrl(network: 'mainnet' | 'testnet', txHash: string): string {
  return `${NETWORKS[network].explorerUrl}/tx/${txHash}`;
}
