import { useEffect, useState } from 'react';
import { sendWalletMessage } from '@/features/wallet/messages';
import { useWalletStore } from '@/features/wallet/store';
import { Header } from '../components/Header';
import { SeedExportModal } from '../components/SeedExportModal';

const AUTO_LOCK_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '60 minutes' },
];

function ChevronRight() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 text-zinc-400"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 text-amber-500"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function SettingsScreen() {
  const push = useWalletStore((s) => s.push);
  const network = useWalletStore((s) => s.network);
  const setNetwork = useWalletStore((s) => s.setNetwork);

  const [autoLockMinutes, setAutoLockMinutes] = useState(15);
  const [seedModalOpen, setSeedModalOpen] = useState(false);

  // Load current auto-lock timeout on mount
  useEffect(() => {
    sendWalletMessage({ type: 'wallet:getAutoLockTimeout' }).then((resp) => {
      if (resp.type === 'wallet:autoLockTimeout') {
        setAutoLockMinutes(resp.minutes);
      }
    });
  }, []);

  async function handleAutoLockChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const minutes = Number(e.target.value);
    setAutoLockMinutes(minutes);
    await sendWalletMessage({ type: 'wallet:setAutoLockTimeout', minutes });
  }

  function handleNetworkToggle() {
    setNetwork(network === 'mainnet' ? 'testnet' : 'mainnet');
  }

  return (
    <>
    <Header />
    <div className="flex flex-1 flex-col overflow-y-auto px-4 pt-4 pb-6">
      {/* Security section */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Security
      </h2>
      <div className="mb-5 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        {/* Auto-Lock Timer */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm">Auto-Lock Timer</span>
          <select
            value={autoLockMinutes}
            onChange={handleAutoLockChange}
            className="rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
          >
            {AUTO_LOCK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-zinc-100 dark:border-zinc-800" />

        {/* Export Seed Phrase */}
        <button
          type="button"
          onClick={() => setSeedModalOpen(true)}
          className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <span className="flex items-center gap-2 text-sm">
            <WarningIcon />
            Export Seed Phrase
          </span>
          <ChevronRight />
        </button>
      </div>

      {/* Network section */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Network
      </h2>
      <div className="mb-5 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleNetworkToggle}
          className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <span className="text-sm">Network</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              network === 'testnet'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
          </span>
        </button>
      </div>

      {/* About section */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        About
      </h2>
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => push('about')}
          className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <span className="text-sm">About megawallet</span>
          <ChevronRight />
        </button>
      </div>

      {/* Seed Export Modal */}
      <SeedExportModal isOpen={seedModalOpen} onClose={() => setSeedModalOpen(false)} />
    </div>
    </>
  );
}
