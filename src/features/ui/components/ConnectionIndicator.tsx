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
    <span
      className="size-2 rounded-full bg-green-500"
      title={`Connected to ${siteName}`}
    />
  );
}
