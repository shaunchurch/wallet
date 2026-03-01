import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWalletStore } from '@/features/wallet/store';
import { validateAddress } from '@/features/wallet/tx/build';
import type { RecentAddress } from '@/features/wallet/types';
import { Jazzicon } from '@/lib/jazzicon';
import { Header } from '../components/Header';

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function SendRecipientScreen() {
  const push = useWalletStore((s) => s.push);
  const setSendTo = useWalletStore((s) => s.setSendTo);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recentAddresses, setRecentAddresses] = useState<RecentAddress[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load recent addresses
  useEffect(() => {
    chrome.storage.local.get('recentAddresses').then((result) => {
      if (result.recentAddresses) {
        setRecentAddresses(result.recentAddresses as RecentAddress[]);
      }
    });
  }, []);

  function handleChange(value: string) {
    setAddress(value);
    if (value.length === 0) {
      setError(null);
      return;
    }
    if (value.length >= 42 || !value.startsWith('0x')) {
      const result = validateAddress(value);
      if (!result.valid) {
        setError(result.error ?? 'Invalid address');
      } else {
        setError(null);
      }
    } else {
      setError(null);
    }
  }

  function handleBlur() {
    if (address.length > 0) {
      const result = validateAddress(address);
      if (!result.valid) {
        setError(result.error ?? 'Invalid address');
      }
    }
  }

  function selectRecent(addr: string) {
    setAddress(addr);
    setError(null);
  }

  const isValid = address.length === 42 && validateAddress(address).valid;

  function handleNext() {
    if (!isValid) return;
    setSendTo(address);
    push('send-amount');
  }

  return (
    <>
      <Header />
      <div className="flex flex-1 flex-col px-4 pt-6 pb-4">
        <h2 className="mb-4 text-lg font-bold text-zinc-900 dark:text-zinc-100">Send to</h2>

        <input
          ref={inputRef}
          type="text"
          placeholder="0x..."
          value={address}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          className={`w-full rounded-lg border px-3 py-2.5 font-mono text-sm outline-none transition-colors ${
            error ? 'border-red-400 dark:border-red-600' : 'border-zinc-300 dark:border-zinc-700'
          } bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-zinc-500 dark:focus:border-zinc-400`}
        />

        {error && <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{error}</p>}

        {/* Recent addresses */}
        {recentAddresses.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Recent</p>
            <div className="space-y-1">
              {recentAddresses.map((recent) => (
                <button
                  key={recent.address}
                  type="button"
                  onClick={() => selectRecent(recent.address)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Jazzicon address={recent.address} size={16} />
                  <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
                    {truncateAddress(recent.address)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-4">
          <Button className="w-full" disabled={!isValid} onClick={handleNext}>
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
