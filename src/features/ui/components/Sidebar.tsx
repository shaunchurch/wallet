import { useCallback, useEffect, useRef, useState } from 'react';
import { sendWalletMessage } from '@/features/wallet/messages';
import { useWalletStore } from '@/features/wallet/store';
import type { DerivedAccount } from '@/features/wallet/types';
import { Jazzicon } from '@/lib/jazzicon';

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function AccountRow({
  account,
  name,
  active,
  onSelect,
  onRename,
}: {
  account: DerivedAccount;
  name: string;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    else setEditValue(name);
    setEditing(false);
  }, [editValue, name, onRename]);

  return (
    <button
      type="button"
      onClick={editing ? undefined : onSelect}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        active ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
      }`}
    >
      <Jazzicon address={account.address} size={36} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setEditValue(name);
                setEditing(false);
              }
            }}
            className="w-full rounded border border-zinc-300 bg-transparent px-1 text-sm font-medium outline-none focus:border-violet-500 dark:border-zinc-600"
          />
        ) : (
          <button
            type="button"
            className="block truncate text-sm font-medium"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {name}
          </button>
        )}
        <span className="block font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {truncateAddress(account.address)}
        </span>
      </div>
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`size-4 shrink-0 ${active ? 'text-violet-500' : 'text-transparent'}`}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  );
}

export function Sidebar() {
  const sidebarOpen = useWalletStore((s) => s.sidebarOpen);
  const closeSidebar = useWalletStore((s) => s.closeSidebar);
  const accounts = useWalletStore((s) => s.accounts);
  const activeAccountIndex = useWalletStore((s) => s.activeAccountIndex);
  const setActiveAccount = useWalletStore((s) => s.setActiveAccount);
  const setAccounts = useWalletStore((s) => s.setAccounts);
  const accountNames = useWalletStore((s) => s.accountNames);
  const setAccountName = useWalletStore((s) => s.setAccountName);
  const reset = useWalletStore((s) => s.reset);
  const push = useWalletStore((s) => s.push);
  const [deriving, setDeriving] = useState(false);

  const handleSelect = useCallback(
    (index: number) => {
      setActiveAccount(index);
      closeSidebar();
    },
    [setActiveAccount, closeSidebar],
  );

  const handleAddAccount = useCallback(async () => {
    if (deriving) return;
    setDeriving(true);
    const nextIndex = accounts.length;
    const resp = await sendWalletMessage({ type: 'wallet:deriveAccount', index: nextIndex });
    if (resp.type === 'wallet:derived') {
      setAccounts([...accounts, resp.account]);
      // Default name if not already set
      if (!accountNames[nextIndex]) {
        setAccountName(nextIndex, `Account ${nextIndex + 1}`);
      }
    }
    setDeriving(false);
  }, [deriving, accounts, setAccounts, accountNames, setAccountName]);

  const handleLock = useCallback(async () => {
    const resp = await sendWalletMessage({ type: 'wallet:lock' });
    if (resp.type === 'wallet:locked') {
      closeSidebar();
      reset('lock');
    }
  }, [closeSidebar, reset]);

  const handleSettings = useCallback(() => {
    closeSidebar();
    push('settings');
  }, [closeSidebar, push]);

  const getAccountName = (index: number) => accountNames[index] || `Account ${index + 1}`;

  return (
    <>
      {/* Overlay */}
      <button
        type="button"
        className="sidebar-overlay"
        data-open={sidebarOpen ? 'true' : 'false'}
        onClick={closeSidebar}
        aria-label="Close sidebar"
        tabIndex={-1}
      />

      {/* Panel */}
      <div
        className="sidebar-panel flex flex-col bg-white dark:bg-zinc-900"
        data-open={sidebarOpen ? 'true' : 'false'}
      >
        {/* Account list */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Accounts
          </p>
          <div className="flex flex-col gap-0.5">
            {accounts.map((account) => (
              <AccountRow
                key={account.index}
                account={account}
                name={getAccountName(account.index)}
                active={account.index === activeAccountIndex}
                onSelect={() => handleSelect(account.index)}
                onRename={(n) => setAccountName(account.index, n)}
              />
            ))}
          </div>

          {/* Add Account */}
          <button
            type="button"
            onClick={handleAddAccount}
            disabled={deriving}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-violet-600 transition-colors hover:bg-violet-50 disabled:opacity-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
          >
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
              <line x1={12} y1={5} x2={12} y2={19} />
              <line x1={5} y1={12} x2={19} y2={12} />
            </svg>
            {deriving ? 'Deriving...' : 'Add Account'}
          </button>
        </div>

        {/* Bottom actions */}
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleLock}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
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
              <rect width={18} height={11} x={3} y={11} rx={2} ry={2} />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Lock Wallet
          </button>
          <button
            type="button"
            onClick={handleSettings}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
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
              <circle cx={12} cy={12} r={3} />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </button>
        </div>
      </div>
    </>
  );
}
