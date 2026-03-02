import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { sendWalletMessage } from '@/features/wallet/messages';
import { useWalletStore } from '@/features/wallet/store';
import { Jazzicon } from '@/lib/jazzicon';
import { Header } from '../components/Header';

function truncateAddress(addr: string): string {
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
    <div className="flex flex-col items-center gap-2 px-4 py-4">
      {favicon ? (
        <img
          src={favicon}
          alt=""
          className="size-10 rounded-lg"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="flex size-10 items-center justify-center rounded-lg bg-zinc-200 text-sm font-bold dark:bg-zinc-700">
          {(title || origin).charAt(0).toUpperCase()}
        </div>
      )}
      <p className="text-sm font-semibold">{title || new URL(origin).hostname}</p>
      <p className="text-xs text-zinc-400">{origin}</p>
    </div>
  );
}

export function DappConnectScreen() {
  const pendingDappRequest = useWalletStore((s) => s.pendingDappRequest);
  const accounts = useWalletStore((s) => s.accounts);
  const accountNames = useWalletStore((s) => s.accountNames);

  const [selected, setSelected] = useState<Set<number>>(() => new Set([0]));
  const [loading, setLoading] = useState(false);

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

  function toggleAccount(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function handleReject() {
    await sendWalletMessage({ type: 'dapp:reject', requestId: id });
    window.close();
  }

  async function handleApprove() {
    setLoading(true);
    try {
      const selectedAddresses = accounts.filter((_, i) => selected.has(i)).map((a) => a.address);
      await sendWalletMessage({
        type: 'dapp:approve',
        requestId: id,
        result: selectedAddresses,
      });
      window.close();
    } catch {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <SiteInfo favicon={favicon} title={title} origin={origin} />

        <p className="px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          wants to connect to your wallet
        </p>

        {/* Account picker */}
        <div className="mt-4 flex-1 space-y-1 px-4">
          {accounts.map((account, idx) => (
            <button
              key={account.address}
              type="button"
              onClick={() => toggleAccount(idx)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <input
                type="checkbox"
                checked={selected.has(idx)}
                onChange={() => toggleAccount(idx)}
                className="size-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100"
              />
              <Jazzicon address={account.address} size={24} />
              <div className="text-left">
                <p className="text-sm font-medium">{accountNames[idx] || `Account ${idx + 1}`}</p>
                <p className="font-mono text-xs text-zinc-400">
                  {truncateAddress(account.address)}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-4 pb-4 pt-3">
          <Button variant="outline" className="flex-1" onClick={handleReject} disabled={loading}>
            Reject
          </Button>
          <Button
            className="flex-1"
            onClick={handleApprove}
            disabled={loading || selected.size === 0}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Connecting...
              </span>
            ) : (
              'Approve'
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
