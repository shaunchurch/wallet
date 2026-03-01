import { Button } from '@/components/ui/button';
import { useWalletStore } from '@/features/wallet/store';
import { Header } from '../components/Header';

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function SendResultScreen() {
  const pop = useWalletStore((s) => s.pop);
  const reset = useWalletStore((s) => s.reset);
  const clearSendState = useWalletStore((s) => s.clearSendState);
  const sendResult = useWalletStore((s) => s.sendResult);
  const sendAmountEth = useWalletStore((s) => s.sendAmountEth);
  const sendTo = useWalletStore((s) => s.sendTo);

  function handleDone() {
    clearSendState();
    reset('main');
  }

  function handleTryAgain() {
    pop(); // back to send-confirm
  }

  function handleViewExplorer() {
    if (sendResult?.explorerUrl) {
      window.open(sendResult.explorerUrl, '_blank');
    }
  }

  if (!sendResult) {
    return (
      <>
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-zinc-500">No result available</p>
        </div>
      </>
    );
  }

  if (sendResult.success) {
    return (
      <>
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          {/* Green checkmark */}
          <div className="flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-8 text-green-600 dark:text-green-400"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div className="text-center">
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Sent {sendAmountEth} ETH
            </p>
            <p className="mt-1 font-mono text-sm text-zinc-500 dark:text-zinc-400">
              to {truncateAddress(sendTo)}
            </p>
          </div>

          <div className="mt-4 flex w-full flex-col gap-2">
            {sendResult.explorerUrl && (
              <Button variant="outline" className="w-full" onClick={handleViewExplorer}>
                View on Explorer
              </Button>
            )}
            <Button className="w-full" onClick={handleDone}>
              Done
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Failure state
  return (
    <>
      <Header />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        {/* Red X icon */}
        <div className="flex size-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-8 text-red-600 dark:text-red-400"
          >
            <line x1={18} y1={6} x2={6} y2={18} />
            <line x1={6} y1={6} x2={18} y2={18} />
          </svg>
        </div>

        <div className="text-center">
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Transaction Failed</p>
          {sendResult.error && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{sendResult.error}</p>
          )}
        </div>

        <div className="mt-4 flex w-full flex-col gap-2">
          <Button className="w-full" onClick={handleTryAgain}>
            Try Again
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              clearSendState();
              reset('main');
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
