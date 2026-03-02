import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  getConnectedSites,
  removeAllConnectedSites,
  removeConnectedSite,
} from '@/features/dapp/connections';
import type { ConnectedSite } from '@/features/dapp/types';
import { Header } from '../components/Header';

function truncateAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ConnectionsScreen() {
  const [sites, setSites] = useState<ConnectedSite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showConfirmAll, setShowConfirmAll] = useState(false);

  async function loadSites() {
    const result = await getConnectedSites();
    setSites(result);
    setLoaded(true);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load once on mount
  useEffect(() => {
    loadSites();
  }, []);

  async function handleDisconnect(origin: string) {
    await removeConnectedSite(origin);
    await loadSites();
  }

  async function handleDisconnectAll() {
    await removeAllConnectedSites();
    setShowConfirmAll(false);
    await loadSites();
  }

  return (
    <>
      <Header />
      <div className="flex flex-1 flex-col overflow-y-auto">
        {!loaded ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="size-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          </div>
        ) : sites.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-zinc-400">No connected sites</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-1 px-4 pt-3">
              {sites.map((site) => (
                <div
                  key={site.origin}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
                >
                  {site.favicon ? (
                    <img
                      src={site.favicon}
                      alt=""
                      className="size-6 rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex size-6 items-center justify-center rounded bg-zinc-200 text-[10px] font-bold dark:bg-zinc-700">
                      {site.origin.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {site.name || new URL(site.origin).hostname}
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      {site.accounts.map(truncateAddr).join(', ')}
                    </p>
                    <p className="text-[10px] text-zinc-400">{relativeTime(site.connectedAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(site.origin)}
                    className="shrink-0 text-xs font-medium text-red-500 transition-colors hover:text-red-600"
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </div>

            {/* Disconnect All */}
            <div className="px-4 pb-4 pt-3">
              {showConfirmAll ? (
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                  <p className="text-sm text-red-700 dark:text-red-400">Are you sure?</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowConfirmAll(false)}>
                      No
                    </Button>
                    <Button
                      size="sm"
                      className="bg-red-500 hover:bg-red-600"
                      onClick={handleDisconnectAll}
                    >
                      Yes
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmAll(true)}
                  className="w-full text-center text-sm font-medium text-red-500 transition-colors hover:text-red-600"
                >
                  Disconnect All
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
