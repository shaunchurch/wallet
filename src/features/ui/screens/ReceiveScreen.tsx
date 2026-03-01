import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWalletStore } from '@/features/wallet/store';
import { Header } from '../components/Header';

export function ReceiveScreen() {
  const accounts = useWalletStore((s) => s.accounts);
  const activeAccountIndex = useWalletStore((s) => s.activeAccountIndex);
  const activeAccount = accounts[activeAccountIndex];
  const address = activeAccount?.address ?? '';

  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  return (
    <>
      <Header />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        {/* QR code card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <QRCodeSVG value={address} size={200} />
        </div>

        {/* Full address */}
        <p className="max-w-full break-all text-center font-mono text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          {address}
        </p>

        {/* Copy button */}
        <Button variant="outline" className="gap-2" onClick={copyAddress}>
          {copied ? (
            <>
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
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
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
                <rect width={14} height={14} x={8} y={8} rx={2} ry={2} />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              Copy Address
            </>
          )}
        </Button>
      </div>
    </>
  );
}
