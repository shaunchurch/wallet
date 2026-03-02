import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { decodeCalldata } from '@/features/dapp/decode';
import { sendWalletMessage } from '@/features/wallet/messages';
import { useWalletStore } from '@/features/wallet/store';
import { formatEth } from '@/features/wallet/tx/format';
import { Header } from '../components/Header';

function truncateAddr(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function SiteInfo({
  favicon,
  title,
  origin,
}: {
  favicon?: string | undefined;
  title?: string | undefined;
  origin: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-w-0">
      {favicon ? (
        <img
          src={favicon}
          alt=""
          className="size-8 shrink-0 rounded"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="flex size-8 shrink-0 items-center justify-center rounded bg-zinc-200 text-xs font-bold dark:bg-zinc-700">
          {(title || origin).charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title || new URL(origin).hostname}</p>
        <p className="truncate text-xs text-zinc-400">{origin}</p>
      </div>
    </div>
  );
}

export function DappConfirmScreen() {
  const pendingDappRequest = useWalletStore((s) => s.pendingDappRequest);
  const accounts = useWalletStore((s) => s.accounts);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Simulation state
  const [simulating, setSimulating] = useState(true);
  const [simResult, setSimResult] = useState<{
    ethBefore: string;
    ethAfter: string;
    success: boolean;
    error?: string | undefined;
  } | null>(null);

  // Gas state (editable)
  const [gasLimit, setGasLimit] = useState('');
  const [maxFeeGwei, setMaxFeeGwei] = useState('');
  const [priorityFeeGwei, setPriorityFeeGwei] = useState('');

  // Derive tx params safely (before hooks boundary)
  const txObj = (pendingDappRequest?.params as unknown[] | undefined)?.[0] as
    | { from: string; to: string; value?: string; data?: string; gas?: string }
    | undefined;
  const from = txObj?.from ?? '';
  const to = txObj?.to ?? '';
  const value = txObj?.value ?? '0x0';
  const data = txObj?.data ?? '0x';
  const accountIndex = accounts.findIndex((a) => a.address.toLowerCase() === from.toLowerCase());

  // Fetch gas + simulate on mount
  useEffect(() => {
    if (!pendingDappRequest) return;
    async function init() {
      try {
        const [feeResp, gasResp] = await Promise.all([
          sendWalletMessage({ type: 'wallet:getFeeParams' }),
          sendWalletMessage({
            type: 'wallet:estimateGas',
            to,
            value: value || '0x0',
            accountIndex: accountIndex >= 0 ? accountIndex : 0,
          }),
        ]);
        if (gasResp.type === 'wallet:gasEstimate') {
          setGasLimit(BigInt(gasResp.gasLimit).toString());
          setMaxFeeGwei((Number(BigInt(gasResp.maxFeePerGas)) / 1e9).toFixed(4));
          setPriorityFeeGwei((Number(BigInt(gasResp.maxPriorityFeePerGas)) / 1e9).toFixed(4));
        } else if (feeResp.type === 'wallet:feeParams') {
          setMaxFeeGwei((Number(BigInt(feeResp.maxFeePerGas)) / 1e9).toFixed(4));
          setPriorityFeeGwei((Number(BigInt(feeResp.priorityFee)) / 1e9).toFixed(4));
        }
      } catch {
        // gas estimation failed -- user can still set manually
      }

      try {
        const simResp = await sendWalletMessage({
          type: 'dapp:simulate',
          txParams: { from, to, value, data },
        });
        if (simResp.type === 'dapp:simulated') {
          setSimResult(simResp);
        }
      } catch {
        setSimResult({ ethBefore: '?', ethAfter: '?', success: false, error: 'Simulation failed' });
      }
      setSimulating(false);
    }
    init();
  }, [pendingDappRequest, from, to, value, data, accountIndex]);

  if (!pendingDappRequest) {
    return (
      <>
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-zinc-400">No pending request</span>
        </div>
      </>
    );
  }

  const { id, origin, favicon, title } = pendingDappRequest;

  const decoded = decodeCalldata(data);
  const ethValue = value && value !== '0x0' ? formatEth(BigInt(value)) : '0';

  // Estimated fee display
  const estimatedFeeEth =
    gasLimit && maxFeeGwei
      ? formatEth(BigInt(gasLimit) * BigInt(Math.round(Number.parseFloat(maxFeeGwei) * 1e9)))
      : '--';

  async function handleReject() {
    await sendWalletMessage({ type: 'dapp:reject', requestId: id });
    window.close();
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const finalParams: {
        from: string;
        to: string;
        value?: string;
        data?: string;
        gas?: string;
        maxFeePerGas?: string;
        maxPriorityFeePerGas?: string;
      } = { from, to };
      if (value && value !== '0x0') finalParams.value = value;
      if (data && data !== '0x') finalParams.data = data;
      if (gasLimit) finalParams.gas = `0x${BigInt(gasLimit).toString(16)}`;
      if (maxFeeGwei) {
        finalParams.maxFeePerGas = `0x${BigInt(Math.round(Number.parseFloat(maxFeeGwei) * 1e9)).toString(16)}`;
      }
      if (priorityFeeGwei) {
        finalParams.maxPriorityFeePerGas = `0x${BigInt(Math.round(Number.parseFloat(priorityFeeGwei) * 1e9)).toString(16)}`;
      }

      const resp = await sendWalletMessage({
        type: 'dapp:executeTx',
        requestId: id,
        txParams: finalParams,
      });
      if (resp.type === 'dapp:txSent') {
        setLoading(false);
        setTimeout(() => window.close(), 500);
      } else if (resp.type === 'wallet:error') {
        setError(resp.error);
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <SiteInfo favicon={favicon} title={title} origin={origin} />

        {/* Contract / Function */}
        <div className="mx-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
          {decoded.name ? (
            <>
              <p className="text-sm font-medium">{decoded.name}</p>
              {decoded.description && (
                <p className="text-xs text-zinc-400">{decoded.description}</p>
              )}
            </>
          ) : data && data !== '0x' ? (
            <>
              <p className="text-sm font-medium">Contract Interaction</p>
              <p className="font-mono text-xs text-zinc-400">{data.slice(0, 10)}...</p>
            </>
          ) : (
            <p className="text-sm font-medium">Send ETH</p>
          )}
          <p className="mt-1 font-mono text-xs text-zinc-400">To: {truncateAddr(to)}</p>
        </div>

        {/* Value */}
        {ethValue !== '0' && (
          <div className="mx-4 mt-2 flex items-center justify-between">
            <span className="text-sm text-zinc-500">Value</span>
            <span className="text-sm font-medium">{ethValue} ETH</span>
          </div>
        )}

        {/* Simulation */}
        <div className="mx-4 mt-3">
          {simulating ? (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="size-3 animate-spin rounded-full border border-zinc-300 border-t-zinc-600" />
              Simulating...
            </div>
          ) : simResult?.success ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-xs dark:border-green-800 dark:bg-green-900/20">
              <span className="text-green-700 dark:text-green-400">
                Balance: {simResult.ethBefore} ETH {'>'} {simResult.ethAfter} ETH
              </span>
            </div>
          ) : simResult?.error ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs dark:border-amber-800 dark:bg-amber-900/20">
              <span className="text-amber-700 dark:text-amber-400">
                Simulation failed: {simResult.error}
              </span>
            </div>
          ) : null}
        </div>

        {/* Gas section */}
        <div className="mx-4 mt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Est. fee</span>
            <span className="text-sm">{estimatedFeeEth} ETH</span>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="mt-1 flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            Advanced
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`size-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showAdvanced && (
            <div className="mt-2 space-y-2">
              <label className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Gas Limit</span>
                <input
                  type="text"
                  value={gasLimit}
                  onChange={(e) => setGasLimit(e.target.value)}
                  className="w-28 rounded border border-zinc-200 bg-transparent px-2 py-1 text-right text-xs dark:border-zinc-700"
                />
              </label>
              <label className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Max Fee (Gwei)</span>
                <input
                  type="text"
                  value={maxFeeGwei}
                  onChange={(e) => setMaxFeeGwei(e.target.value)}
                  className="w-28 rounded border border-zinc-200 bg-transparent px-2 py-1 text-right text-xs dark:border-zinc-700"
                />
              </label>
              <label className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Priority Fee (Gwei)</span>
                <input
                  type="text"
                  value={priorityFeeGwei}
                  onChange={(e) => setPriorityFeeGwei(e.target.value)}
                  className="w-28 rounded border border-zinc-200 bg-transparent px-2 py-1 text-right text-xs dark:border-zinc-700"
                />
              </label>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex gap-3 px-4 pb-4 pt-3">
          <Button variant="outline" className="flex-1" onClick={handleReject} disabled={loading}>
            Reject
          </Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Sending...
              </span>
            ) : (
              'Confirm'
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
