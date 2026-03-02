import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { sendWalletMessage } from '@/features/wallet/messages';
import { useWalletStore } from '@/features/wallet/store';
import { calculateMaxSend, formatEth, formatUsd, parseEthToWei } from '@/features/wallet/tx/format';
import { Header } from '../components/Header';

export function SendAmountScreen() {
  const push = useWalletStore((s) => s.push);
  const setSendAmount = useWalletStore((s) => s.setSendAmount);
  const sendTo = useWalletStore((s) => s.sendTo);
  const activeAccountIndex = useWalletStore((s) => s.activeAccountIndex);

  const [ethInput, setEthInput] = useState('');
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);
  const [balanceEth, setBalanceEth] = useState<string | null>(null);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [primaryMode, setPrimaryMode] = useState<'eth' | 'usd'>('eth');
  const [error, setError] = useState<string | null>(null);
  const [loadingMax, setLoadingMax] = useState(false);
  const [estimatedGasWei, setEstimatedGasWei] = useState<bigint | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch balance + price + gas estimate on mount
  useEffect(() => {
    Promise.all([
      sendWalletMessage({ type: 'wallet:getBalance', accountIndex: activeAccountIndex }),
      sendWalletMessage({ type: 'wallet:getEthPrice' }),
      sendWalletMessage({ type: 'wallet:estimateGas', to: sendTo, value: '0x0', accountIndex: activeAccountIndex }),
    ]).then(([balResp, priceResp, gasResp]) => {
      if (balResp.type === 'wallet:balance') {
        setBalanceWei(BigInt(balResp.balanceWei));
        setBalanceEth(balResp.balanceEth);
      }
      if (priceResp.type === 'wallet:ethPrice') {
        setEthPrice(priceResp.usd);
      }
      if (gasResp.type === 'wallet:gasEstimate') {
        setEstimatedGasWei(BigInt(gasResp.gasLimit) * BigInt(gasResp.maxFeePerGas));
      }
    });
  }, [activeAccountIndex, sendTo]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Parse input to ETH amount (for display only — use getWei() for precision)
  function getEthAmount(): number {
    const val = Number.parseFloat(ethInput || '0');
    if (primaryMode === 'usd') {
      if (!ethPrice || ethPrice <= 0) return 0;
      return val / ethPrice;
    }
    return val;
  }

  function getWei(): bigint {
    try {
      if (!ethInput || ethInput === '.') return 0n;
      if (primaryMode === 'eth') {
        // String-based: no float intermediate, lossless to 18 decimals
        return parseEthToWei(ethInput);
      }
      // USD mode: float division is inherent (fiat precision ~2 decimals)
      if (!ethPrice || ethPrice <= 0) return 0n;
      const ethAmt = Number.parseFloat(ethInput) / ethPrice;
      if (ethAmt <= 0 || Number.isNaN(ethAmt)) return 0n;
      return parseEthToWei(ethAmt.toFixed(18));
    } catch {
      return 0n;
    }
  }

  // Validation (gas-aware per plan requirement)
  function validate(wei: bigint): string | null {
    if (wei <= 0n) return null; // don't show error for empty input
    if (balanceWei == null) return null;
    if (wei > balanceWei) return 'Insufficient balance';
    if (estimatedGasWei != null && wei + estimatedGasWei > balanceWei)
      return 'Insufficient balance for gas';
    return null;
  }

  const currentWei = getWei();
  const currentError = error || validate(currentWei);
  const isValid = currentWei > 0n && !currentError;

  // Secondary display
  const ethAmount = getEthAmount();
  const fiatEquivalent = ethPrice != null ? ethAmount * ethPrice : 0;
  const secondaryText =
    primaryMode === 'eth'
      ? formatUsd(fiatEquivalent)
      : `${ethAmount > 0 ? ethAmount.toFixed(6) : '0'} ETH`;

  async function handleMax() {
    if (balanceWei == null) return;
    setLoadingMax(true);
    try {
      const gasResp = await sendWalletMessage({
        type: 'wallet:estimateGas',
        to: sendTo,
        value: '0x0',
        accountIndex: activeAccountIndex,
      });
      if (gasResp.type === 'wallet:gasEstimate') {
        const gasLimit = BigInt(gasResp.gasLimit);
        const maxFee = BigInt(gasResp.maxFeePerGas);
        const maxSend = calculateMaxSend(balanceWei, gasLimit, maxFee);
        const ethStr = formatEth(maxSend);
        setEthInput(ethStr === '0' ? '0' : ethStr);
        setPrimaryMode('eth');
        setError(null);
      }
    } catch {
      setError('Failed to estimate gas');
    } finally {
      setLoadingMax(false);
    }
  }

  function handleNext() {
    if (!isValid) return;
    const weiHex = `0x${currentWei.toString(16)}`;
    const ethDisplay = `${ethAmount.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`;
    setSendAmount(weiHex, ethDisplay);
    push('send-confirm');
  }

  return (
    <>
      <Header />
      <div className="flex flex-1 flex-col px-4 pt-4 pb-4">
        {/* Available balance */}
        {balanceEth != null && (
          <p className="mb-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
            Balance: {balanceEth} ETH
          </p>
        )}

        {/* Amount input */}
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <div className="relative flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={ethInput}
              onChange={(e) => {
                // Allow only numbers and decimal point
                const v = e.target.value.replace(/[^0-9.]/g, '');
                if (v.split('.').length > 2) return;
                setEthInput(v);
                setError(null);
              }}
              className="w-48 border-none bg-transparent text-center text-4xl font-bold text-zinc-900 outline-none placeholder:text-zinc-300 dark:text-zinc-100 dark:placeholder:text-zinc-700"
            />
            <span className="text-lg font-medium text-zinc-400 dark:text-zinc-500">
              {primaryMode === 'eth' ? 'ETH' : 'USD'}
            </span>
          </div>

          <p className="text-sm text-zinc-400 dark:text-zinc-500">{secondaryText}</p>

          {/* Toggle + Max buttons */}
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPrimaryMode((m) => (m === 'eth' ? 'usd' : 'eth'));
                setEthInput('');
              }}
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {primaryMode === 'eth' ? 'USD' : 'ETH'}
            </button>
            <button
              type="button"
              onClick={handleMax}
              disabled={loadingMax || balanceWei == null}
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {loadingMax ? '...' : 'Max'}
            </button>
          </div>
        </div>

        {/* Error */}
        {currentError && (
          <p className="mb-2 text-center text-xs text-red-500 dark:text-red-400">{currentError}</p>
        )}

        <Button className="w-full" disabled={!isValid} onClick={handleNext}>
          Next
        </Button>
      </div>
    </>
  );
}
