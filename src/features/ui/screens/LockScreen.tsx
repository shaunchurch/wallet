import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { sendWalletMessage } from '@/features/wallet/messages';
import { useWalletStore } from '@/features/wallet/store';

export function LockScreen() {
  const reset = useWalletStore((s) => s.reset);
  const setAccounts = useWalletStore((s) => s.setAccounts);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [lockedUntilMs, setLockedUntilMs] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus password input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Check lockout status on mount
  useEffect(() => {
    sendWalletMessage({ type: 'wallet:getLockoutStatus' }).then((resp) => {
      if (resp.type === 'wallet:lockoutStatus' && resp.locked) {
        setLockedUntilMs(Date.now() + resp.remainingMs);
      }
    });
  }, []);

  // Countdown timer when locked out
  useEffect(() => {
    if (lockedUntilMs <= 0) {
      setCountdown(0);
      return;
    }

    function tick() {
      const remaining = Math.max(0, lockedUntilMs - Date.now());
      const secs = Math.ceil(remaining / 1000);
      setCountdown(secs);
      if (remaining <= 0) {
        setLockedUntilMs(0);
        setCountdown(0);
        setError('');
      }
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntilMs]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  }, []);

  async function handleUnlock() {
    if (!password || loading || countdown > 0) return;
    setLoading(true);
    setError('');

    const resp = await sendWalletMessage({ type: 'wallet:unlock', password });

    if (resp.type === 'wallet:unlocked') {
      // Fetch accounts after unlock
      const acctResp = await sendWalletMessage({ type: 'wallet:getAccounts' });
      if (acctResp.type === 'wallet:accounts') {
        setAccounts(acctResp.accounts);
      }
      reset('main');
      return;
    }

    if (resp.type === 'wallet:error') {
      triggerShake();
      setError(resp.error);
      setPassword('');

      // Check lockout status after error
      const lockResp = await sendWalletMessage({ type: 'wallet:getLockoutStatus' });
      if (lockResp.type === 'wallet:lockoutStatus' && lockResp.locked) {
        setLockedUntilMs(Date.now() + lockResp.remainingMs);
      }
    }

    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleUnlock();
  }

  const isLockedOut = countdown > 0;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8">
      {/* Logo */}
      <div className="mb-8 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl font-bold text-white shadow-lg">
        M
      </div>

      {isLockedOut ? (
        /* Lockout countdown */
        <div className="flex w-full flex-col items-center gap-4">
          <p className="text-sm font-medium text-red-500">Too many failed attempts</p>
          <p className="text-3xl font-bold tabular-nums">{countdown}s</p>
          <p className="text-xs text-zinc-500">Try again when the timer expires</p>
        </div>
      ) : (
        /* Password form */
        <div className="flex w-full flex-col gap-4">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter password"
              className={`h-10 w-full rounded-md border bg-transparent px-3 pr-10 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500 ${
                error ? 'border-red-500' : 'border-zinc-200 dark:border-zinc-800'
              } ${shake ? 'animate-shake' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {error && <p className="text-center text-xs text-red-500">{error}</p>}

          <Button
            size="lg"
            className="w-full"
            disabled={!password || loading}
            onClick={handleUnlock}
          >
            {loading ? 'Unlocking...' : 'Unlock'}
          </Button>
        </div>
      )}
    </div>
  );
}
