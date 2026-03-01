import { wordlist } from '@scure/bip39/wordlists/english.js';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/features/ui/OnboardingContext';
import { sendWalletMessage } from '@/features/wallet/messages';
import { useWalletStore } from '@/features/wallet/store';

interface Challenge {
  position: number;
  correctWord: string;
  options: string[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

function generateChallenges(words: string[]): Challenge[] {
  const positions = Array.from({ length: words.length }, (_, i) => i);
  const selected: number[] = [];
  while (selected.length < 3) {
    const idx = Math.floor(Math.random() * positions.length);
    const pos = positions[idx] as number;
    if (!selected.includes(pos)) selected.push(pos);
  }

  return selected
    .sort((a, b) => a - b)
    .map((pos) => {
      const correct = words[pos] as string;
      // Pick 3 wrong words from BIP-39 wordlist not in user's phrase
      const phraseSet = new Set(words);
      const wrong: string[] = [];
      while (wrong.length < 3) {
        const w = wordlist[Math.floor(Math.random() * wordlist.length)] as string;
        if (!phraseSet.has(w) && !wrong.includes(w) && w !== correct) {
          wrong.push(w);
        }
      }
      return { position: pos, correctWord: correct, options: shuffle([correct, ...wrong]) };
    });
}

export function ConfirmSeedScreen() {
  const reset = useWalletStore((s) => s.reset);
  const setAccounts = useWalletStore((s) => s.setAccounts);
  const { mnemonic, clearOnboardingData } = useOnboarding();

  const words = useMemo(() => mnemonic?.split(' ') ?? [], [mnemonic]);
  const [challenges, setChallenges] = useState<Challenge[]>(() => generateChallenges(words));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const challenge = challenges[currentIdx];

  const handleSelect = useCallback(
    async (word: string) => {
      if (!challenge || loading) return;

      if (word !== challenge.correctWord) {
        setError('Incorrect. Try again.');
        // Regenerate all challenges
        const newChallenges = generateChallenges(words);
        setChallenges(newChallenges);
        setCurrentIdx(0);
        return;
      }

      setError('');

      // Last challenge -- send confirmation to background
      if (currentIdx === challenges.length - 1) {
        setLoading(true);
        const wordIndices = challenges.map((c) => ({
          position: c.position,
          word: c.correctWord,
        }));
        const resp = await sendWalletMessage({
          type: 'wallet:confirmSeedPhrase',
          wordIndices,
        });
        if (resp.type === 'wallet:confirmed') {
          clearOnboardingData();
          // Fetch accounts after confirmation
          const acctResp = await sendWalletMessage({ type: 'wallet:getAccounts' });
          if (acctResp.type === 'wallet:accounts') {
            setAccounts(acctResp.accounts);
          }
          reset('main');
        } else if (resp.type === 'wallet:error') {
          setError(resp.error);
          setLoading(false);
        }
        return;
      }

      setCurrentIdx((i) => i + 1);
    },
    [challenge, challenges, currentIdx, loading, words, clearOnboardingData, reset, setAccounts],
  );

  if (!challenge) return <div />;

  return (
    <div className="flex flex-1 flex-col px-6 pt-8">
      <h1 className="text-xl font-bold">Confirm Recovery Phrase</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Select the correct word for each position to verify you saved your phrase.
      </p>

      {/* Progress */}
      <div className="mt-4 flex gap-1">
        {challenges.map((_, i) => (
          <div
            key={`seg-${challenges[i]?.position}`}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < currentIdx
                ? 'bg-green-500'
                : i === currentIdx
                  ? 'bg-violet-500'
                  : 'bg-zinc-200 dark:bg-zinc-800'
            }`}
          />
        ))}
      </div>

      {/* Challenge */}
      <div className="mt-8 flex flex-col items-center gap-6">
        <p className="text-lg font-semibold">What is word #{challenge.position + 1}?</p>

        <div className="grid w-full grid-cols-2 gap-3">
          {challenge.options.map((opt) => (
            <Button
              key={opt}
              variant="outline"
              size="lg"
              className="w-full"
              disabled={loading}
              onClick={() => handleSelect(opt)}
            >
              {opt}
            </Button>
          ))}
        </div>
      </div>

      {error && <p className="mt-4 text-center text-sm text-red-500">{error}</p>}

      <p className="mt-auto pb-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
        Challenge {currentIdx + 1} of {challenges.length}
      </p>
    </div>
  );
}
