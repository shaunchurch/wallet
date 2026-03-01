import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { sendWalletMessage } from '@/features/wallet/messages';

type Step = 'password' | 'warning' | 'reveal';

interface SeedExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SeedExportModal({ isOpen, onClose }: SeedExportModalProps) {
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus password input when modal opens
  useEffect(() => {
    if (isOpen && step === 'password') {
      // Delay to allow modal transition
      const id = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [isOpen, step]);

  // Clear all state when modal closes
  const handleClose = useCallback(() => {
    setStep('password');
    setPassword('');
    setShowPassword(false);
    setError('');
    setLoading(false);
    setShake(false);
    setMnemonic('');
    onClose();
  }, [onClose]);

  // Also clear mnemonic on unmount as safety net
  useEffect(() => {
    return () => {
      setMnemonic('');
    };
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  }, []);

  async function handleSubmitPassword() {
    if (!password || loading) return;
    setLoading(true);
    setError('');

    const resp = await sendWalletMessage({
      type: 'wallet:exportSeedPhrase',
      password,
    });

    if (resp.type === 'wallet:seedPhrase') {
      setMnemonic(resp.mnemonic);
      setStep('warning');
      setPassword('');
    } else if (resp.type === 'wallet:error') {
      triggerShake();
      setError(resp.error);
      setPassword('');
    }

    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmitPassword();
  }

  if (!isOpen) return null;

  const words = mnemonic.split(' ').filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
        aria-label="Close modal"
      />

      {/* Modal card */}
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        {/* Step 1: Password */}
        {step === 'password' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">Export Seed Phrase</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Enter your password to export your recovery phrase.
            </p>

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

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!password || loading}
                onClick={handleSubmitPassword}
              >
                {loading ? 'Verifying...' : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Warning */}
        {step === 'warning' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">Security Warning</h2>

            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-950/30">
              <div className="flex items-start gap-2">
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 size-5 shrink-0 text-red-500"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Your seed phrase is the master key to your wallet. Anyone who sees it can steal
                  all your funds. Never share it. Never enter it on a website.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => setStep('reveal')}>
                I Understand, Show Phrase
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Reveal */}
        {step === 'reveal' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">Recovery Phrase</h2>

            {/* 3x4 grid -- same as SeedPhraseScreen */}
            <div className="grid grid-cols-3 gap-2">
              {words.map((word, i) => (
                <div
                  key={`${i}-${word}`}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-2 dark:bg-zinc-800"
                >
                  <span className="text-xs font-medium text-zinc-400 dark:text-zinc-600">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{word}</span>
                </div>
              ))}
            </div>

            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
