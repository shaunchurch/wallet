import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/features/ui/OnboardingContext';
import { useWalletStore } from '@/features/wallet/store';

export function ImportSeedScreen() {
  const push = useWalletStore((s) => s.push);
  const { setOnboardingData } = useOnboarding();

  const [input, setInput] = useState('');

  const words = input.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const validCount = words.length === 12 || words.length === 24;

  function handleContinue() {
    if (!validCount) return;
    setOnboardingData({ mnemonic: words.join(' ') });
    push('import-password');
  }

  return (
    <div className="flex flex-1 flex-col px-6 pt-12">
      <h1 className="text-xl font-bold">Import Wallet</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Enter your 12 or 24 word recovery phrase, separated by spaces.
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter recovery phrase..."
        rows={4}
        className="mt-6 w-full resize-none rounded-md border border-zinc-200 bg-transparent p-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 dark:border-zinc-800"
      />

      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
        {words.length > 0 ? `${words.length} words entered` : 'Paste or type your phrase'}
      </p>

      <div className="mt-auto pb-6">
        <Button size="lg" className="w-full" disabled={!validCount} onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
