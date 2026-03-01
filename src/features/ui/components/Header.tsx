import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWalletStore } from '@/features/wallet/store';
import { Jazzicon } from '@/lib/jazzicon';
import { useTheme } from '../ThemeProvider';

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const SUB_SCREENS = new Set([
  'receive',
  'settings',
  'about',
  'send-recipient',
  'send-amount',
  'send-confirm',
  'send-result',
]);

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? (
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <circle cx={12} cy={12} r={5} />
          <line x1={12} y1={1} x2={12} y2={3} />
          <line x1={12} y1={21} x2={12} y2={23} />
          <line x1={4.22} y1={4.22} x2={5.64} y2={5.64} />
          <line x1={18.36} y1={18.36} x2={19.78} y2={19.78} />
          <line x1={1} y1={12} x2={3} y2={12} />
          <line x1={21} y1={12} x2={23} y2={12} />
          <line x1={4.22} y1={19.78} x2={5.64} y2={18.36} />
          <line x1={18.36} y1={5.64} x2={19.78} y2={4.22} />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </Button>
  );
}

function NetworkPill() {
  const network = useWalletStore((s) => s.network);
  const setNetwork = useWalletStore((s) => s.setNetwork);

  return (
    <button
      type="button"
      onClick={() => setNetwork(network === 'mainnet' ? 'testnet' : 'mainnet')}
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
        network === 'testnet'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
      }`}
    >
      {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
    </button>
  );
}

const SCREEN_TITLES: Record<string, string> = {
  receive: 'Receive',
  settings: 'Settings',
  about: 'About',
  'send-recipient': 'Send',
  'send-amount': 'Amount',
  'send-confirm': 'Confirm',
  'send-result': 'Result',
};

export function Header() {
  const currentScreen = useWalletStore((s) => s.currentScreen);
  const accounts = useWalletStore((s) => s.accounts);
  const activeAccountIndex = useWalletStore((s) => s.activeAccountIndex);
  const toggleSidebar = useWalletStore((s) => s.toggleSidebar);
  const pop = useWalletStore((s) => s.pop);

  const activeAccount = accounts[activeAccountIndex];
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(() => {
    if (!activeAccount) return;
    navigator.clipboard.writeText(activeAccount.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [activeAccount]);

  // --- Sub-screen mode: back arrow + title ---
  if (SUB_SCREENS.has(currentScreen)) {
    return (
      <header className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <Button variant="ghost" size="icon-sm" onClick={pop} aria-label="Go back">
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <line x1={19} y1={12} x2={5} y2={12} />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Button>
        <span className="text-sm font-semibold">{SCREEN_TITLES[currentScreen] ?? ''}</span>
        <ThemeToggle />
      </header>
    );
  }

  // --- Main screen mode: avatar + network pill ---
  if (currentScreen === 'main' && activeAccount) {
    return (
      <header className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex items-center gap-2 rounded-lg p-0.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Open sidebar"
          >
            <Jazzicon address={activeAccount.address} size={28} />
          </button>
          <button
            type="button"
            onClick={copyAddress}
            className="font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {copied ? 'Copied!' : truncateAddress(activeAccount.address)}
          </button>
          <NetworkPill />
        </div>
        <ThemeToggle />
      </header>
    );
  }

  // --- Onboarding/lock mode: branding ---
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="font-mono text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        megawallet
      </span>
      <ThemeToggle />
    </header>
  );
}
