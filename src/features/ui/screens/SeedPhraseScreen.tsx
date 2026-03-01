import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/features/ui/OnboardingContext';
import { useWalletStore } from '@/features/wallet/store';

export function SeedPhraseScreen() {
  const push = useWalletStore((s) => s.push);
  const { mnemonic } = useOnboarding();

  const words = mnemonic?.split(' ') ?? [];

  return (
    <div className="flex flex-1 flex-col px-6 pt-8">
      <h1 className="text-xl font-bold">Recovery Phrase</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Write down these 12 words in order. You will need them to recover your wallet. Never share
        them with anyone.
      </p>

      {/* 3x4 grid */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        {words.map((word, i) => (
          <div
            key={`${i}-${word}`}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-2.5 py-2 dark:bg-zinc-900"
          >
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-600">{i + 1}</span>
            <span className="text-sm font-medium">{word}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto pb-6">
        <Button size="lg" className="w-full" onClick={() => push('confirm-seed')}>
          I've Written It Down
        </Button>
      </div>
    </div>
  );
}
