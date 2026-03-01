import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/features/ui/OnboardingContext';
import { sendWalletMessage } from '@/features/wallet/messages';
import { useWalletStore } from '@/features/wallet/store';
import { getPasswordStrength, type Strength } from '@/lib/password-strength';

const strengthColors: Record<Strength, string> = {
  weak: 'bg-red-500',
  medium: 'bg-yellow-500',
  strong: 'bg-green-500',
};

const strengthSegments: Record<Strength, number> = {
  weak: 1,
  medium: 2,
  strong: 3,
};

const strengthLabels: Record<Strength, string> = {
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
};

export function ImportPasswordScreen() {
  const reset = useWalletStore((s) => s.reset);
  const setAccounts = useWalletStore((s) => s.setAccounts);
  const { mnemonic, clearOnboardingData } = useOnboarding();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(password);
  const segments = strengthSegments[strength];
  const valid = password.length >= 8 && password === confirm;

  async function handleSubmit() {
    if (!valid || loading || !mnemonic) return;
    setLoading(true);
    setError('');

    const resp = await sendWalletMessage({ type: 'wallet:import', password, mnemonic });
    if (resp.type === 'wallet:imported') {
      clearOnboardingData();
      // Fetch accounts after import
      const acctResp = await sendWalletMessage({ type: 'wallet:getAccounts' });
      if (acctResp.type === 'wallet:accounts') {
        setAccounts(acctResp.accounts);
      }
      reset('main');
    } else if (resp.type === 'wallet:error') {
      setError(resp.error);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-1 flex-col px-6 pt-12">
      <h1 className="text-xl font-bold">Set Password</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Create a password to encrypt your wallet on this device.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {/* Password field */}
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="import-password">
            Password
          </label>
          <div className="relative">
            <input
              id="import-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 pr-10 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-zinc-800"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Strength meter */}
          {password.length > 0 && (
            <div className="mt-2">
              <div className="flex gap-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= segments ? strengthColors[strength] : 'bg-zinc-200 dark:bg-zinc-800'
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{strengthLabels[strength]}</p>
            </div>
          )}
        </div>

        {/* Confirm password field */}
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="import-confirm">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="import-confirm"
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className="h-10 w-full rounded-md border border-zinc-200 bg-transparent px-3 pr-10 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-zinc-800"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500"
            >
              {showConfirm ? 'Hide' : 'Show'}
            </button>
          </div>
          {confirm.length > 0 && password !== confirm && (
            <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button
          size="lg"
          className="mt-2 w-full"
          disabled={!valid || loading}
          onClick={handleSubmit}
        >
          {loading ? 'Importing...' : 'Import Wallet'}
        </Button>
      </div>
    </div>
  );
}
