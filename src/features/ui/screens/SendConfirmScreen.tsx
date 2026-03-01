import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { sendWalletMessage } from '@/features/wallet/messages';
import { useWalletStore } from '@/features/wallet/store';
import { formatEth, formatUsd } from '@/features/wallet/tx/format';
import { Jazzicon } from '@/lib/jazzicon';
import { Header } from '../components/Header';

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function SendConfirmScreen() {
  const push = useWalletStore((s) => s.push);
  const reset = useWalletStore((s) => s.reset);
  const setSendResult = useWalletStore((s) => s.setSendResult);
  const clearSendState = useWalletStore((s) => s.clearSendState);
  const sendTo = useWalletStore((s) => s.sendTo);
  const sendAmountWei = useWalletStore((s) => s.sendAmountWei);
  const sendAmountEth = useWalletStore((s) => s.sendAmountEth);
  const accounts = useWalletStore((s) => s.accounts);
  const activeAccountIndex = useWalletStore((s) => s.activeAccountIndex);

  const [gasLimit, setGasLimit] = useState<string | null>(null);
  const [maxFeePerGas, setMaxFeePerGas] = useState<string | null>(null);
  const [maxPriorityFee, setMaxPriorityFee] = useState<string | null>(null);
  const [feeWei, setFeeWei] = useState<string | null>(null);
  const [feeEth, setFeeEth] = useState<string | null>(null);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [expandedTo, setExpandedTo] = useState(false);

  const activeAccount = accounts[activeAccountIndex];
  const fromAddress = activeAccount?.address ?? '';

  // Fetch gas estimate + price on mount
  useEffect(() => {
    Promise.all([
      sendWalletMessage({
        type: 'wallet:estimateGas',
        to: sendTo,
        value: sendAmountWei,
        accountIndex: activeAccountIndex,
      }),
      sendWalletMessage({ type: 'wallet:getEthPrice' }),
    ]).then(([gasResp, priceResp]) => {
      if (gasResp.type === 'wallet:gasEstimate') {
        setGasLimit(gasResp.gasLimit);
        setMaxFeePerGas(gasResp.maxFeePerGas);
        setMaxPriorityFee(gasResp.maxPriorityFeePerGas);
        setFeeWei(gasResp.estimatedFeeWei);
        setFeeEth(gasResp.estimatedFeeEth);
      }
      if (priceResp.type === 'wallet:ethPrice') {
        setEthPrice(priceResp.usd);
      }
    });
  }, [sendTo, sendAmountWei, activeAccountIndex]);

  const amountWei = BigInt(sendAmountWei || '0');
  const feeWeiBig = feeWei ? BigInt(feeWei) : 0n;
  const totalWei = amountWei + feeWeiBig;

  const amountFiat = ethPrice != null ? Number.parseFloat(sendAmountEth || '0') * ethPrice : 0;
  const feeFiat = ethPrice != null && feeEth != null ? Number.parseFloat(feeEth) * ethPrice : 0;
  const totalFiat = amountFiat + feeFiat;

  // Format gas details for expandable section
  const gasLimitDisplay = gasLimit ? BigInt(gasLimit).toString() : '--';
  const maxFeeGwei = maxFeePerGas ? (Number(BigInt(maxFeePerGas)) / 1e9).toFixed(4) : '--';
  const priorityGwei = maxPriorityFee ? (Number(BigInt(maxPriorityFee)) / 1e9).toFixed(4) : '--';

  async function handleConfirm() {
    setSending(true);
    try {
      const resp = await sendWalletMessage({
        type: 'wallet:sendTransaction',
        to: sendTo,
        value: sendAmountWei,
        accountIndex: activeAccountIndex,
      });
      if (resp.type === 'wallet:txResult') {
        setSendResult(resp);
      } else if (resp.type === 'wallet:error') {
        setSendResult({
          success: false,
          txHash: '',
          explorerUrl: '',
          error: resp.error,
        });
      }
      push('send-result');
    } catch (err) {
      setSendResult({
        success: false,
        txHash: '',
        explorerUrl: '',
        error: err instanceof Error ? err.message : 'Transaction failed',
      });
      push('send-result');
    }
  }

  function handleCancel() {
    clearSendState();
    reset('main');
  }

  return (
    <>
      <Header />
      <div className="flex flex-1 flex-col px-4 pt-4 pb-4">
        {/* Card */}
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          {/* From */}
          <div className="flex items-center gap-3 px-4 py-3">
            <Jazzicon address={fromAddress} size={28} />
            <div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">From</p>
              <p className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
                {truncateAddress(fromAddress)}
              </p>
            </div>
          </div>

          {/* Arrow separator */}
          <div className="flex justify-center">
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 text-zinc-300 dark:text-zinc-600"
            >
              <line x1={12} y1={5} x2={12} y2={19} />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          </div>

          {/* To */}
          <button
            type="button"
            onClick={() => setExpandedTo((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <Jazzicon address={sendTo} size={28} />
            <div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">To</p>
              <p className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
                {expandedTo ? sendTo : truncateAddress(sendTo)}
              </p>
            </div>
          </button>

          {/* Divider */}
          <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />

          {/* Amount */}
          <div className="px-4 py-3">
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {sendAmountEth} ETH
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">~{formatUsd(amountFiat)}</p>
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />

          {/* Network fee */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Network fee</p>
              <p className="text-sm text-zinc-800 dark:text-zinc-200">
                {feeEth ? `${feeEth} ETH` : '...'}{' '}
                <span className="text-zinc-400 dark:text-zinc-500">(~{formatUsd(feeFiat)})</span>
              </p>
            </div>

            {/* Expandable gas details */}
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="mt-1 flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              Details
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`size-3 transition-transform ${showDetails ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showDetails && (
              <div className="mt-2 space-y-1 text-xs text-zinc-400 dark:text-zinc-500">
                <div className="flex justify-between">
                  <span>Gas limit</span>
                  <span>{gasLimitDisplay}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max fee</span>
                  <span>{maxFeeGwei} gwei</span>
                </div>
                <div className="flex justify-between">
                  <span>Priority fee</span>
                  <span>{priorityGwei} gwei</span>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />

          {/* Total */}
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total</p>
            <div className="text-right">
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {formatEth(totalWei)} ETH
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">~{formatUsd(totalFiat)}</p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-auto flex gap-3 pt-4">
          <Button variant="outline" className="flex-1" onClick={handleCancel} disabled={sending}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={sending || feeWei == null}>
            {sending ? (
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
