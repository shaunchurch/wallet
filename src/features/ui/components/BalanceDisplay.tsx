import { useEffect, useState } from 'react';
import { sendWalletMessage } from '@/features/wallet/messages';
import { useWalletStore } from '@/features/wallet/store';
import { formatEth, formatUsd, parseEthToWei } from '@/features/wallet/tx/format';

export function BalanceDisplay() {
  const activeAccountIndex = useWalletStore((s) => s.activeAccountIndex);
  const [balanceEth, setBalanceEth] = useState<string | null>(null);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;

    Promise.all([
      sendWalletMessage({ type: 'wallet:getBalance', accountIndex: activeAccountIndex }),
      sendWalletMessage({ type: 'wallet:getEthPrice' }),
    ])
      .then(([balResp, priceResp]) => {
        if (cancelled) return;
        if (balResp.type === 'wallet:balance') {
          setBalanceEth(balResp.balanceEth);
        }
        if (priceResp.type === 'wallet:ethPrice') {
          setEthPrice(priceResp.usd);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeAccountIndex]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-1 px-4 pt-8 pb-2">
        <div className="h-9 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-5 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    );
  }

  const ethBigint = balanceEth ? parseEthToWei(balanceEth) : 0n;
  const ethFormatted = formatEth(ethBigint);
  const fiatAmount =
    balanceEth != null && ethPrice != null ? Number.parseFloat(balanceEth) * ethPrice : 0;

  return (
    <div className="flex flex-col items-center gap-1 px-4 pt-8 pb-2">
      <p className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        {ethFormatted} ETH
      </p>
      <p className="text-sm text-zinc-400 dark:text-zinc-500">{formatUsd(fiatAmount)}</p>
    </div>
  );
}
