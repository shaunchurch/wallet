import { Button } from '@/components/ui/button';
import { useWalletStore } from '@/features/wallet/store';

export function WelcomeScreen() {
  const push = useWalletStore((s) => s.push);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
      {/* Logo / Branding */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl font-bold text-white shadow-lg">
          V
        </div>
        <h1 className="text-2xl font-bold tracking-tight">vibewallet</h1>
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          The fastest wallet for the fastest chain
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex w-full flex-col gap-3">
        <Button size="lg" className="w-full" onClick={() => push('create-password')}>
          Create New Wallet
        </Button>
        <Button size="lg" variant="outline" className="w-full" onClick={() => push('import-seed')}>
          Import Existing Wallet
        </Button>
      </div>
    </div>
  );
}
