import { useEffect, useState } from 'react';
import type { ConnectedSite } from '@/features/dapp/types';

export function ConnectionIndicator() {
  const [siteName, setSiteName] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) return;
        const origin = new URL(tab.url).origin;
        const { connectedSites } = await chrome.storage.local.get('connectedSites');
        if (!Array.isArray(connectedSites)) return;
        const match = (connectedSites as ConnectedSite[]).find((s) => s.origin === origin);
        if (match) {
          setSiteName(match.name || new URL(match.origin).hostname);
        }
      } catch {
        // tabs API may fail in certain contexts
      }
    }
    check();
  }, []);

  if (!siteName) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="size-2 rounded-full bg-green-500" />
      <span className="max-w-[100px] truncate text-xs text-zinc-500 dark:text-zinc-400">
        {siteName}
      </span>
    </div>
  );
}
