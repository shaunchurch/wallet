import { useWalletStore } from '@/features/wallet/store';

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}

function ActionButton({ icon, label, disabled, onClick }: ActionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
      title={disabled ? 'Coming soon' : undefined}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-zinc-100 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700">
        {icon}
      </div>
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
    </button>
  );
}

export function ActionButtons() {
  const push = useWalletStore((s) => s.push);

  return (
    <div className="flex justify-center gap-8 py-4">
      {/* Send -- disabled placeholder */}
      <ActionButton
        disabled
        label="Send"
        icon={
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
          >
            <line x1={12} y1={19} x2={12} y2={5} />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        }
      />

      {/* Receive -- active */}
      <ActionButton
        label="Receive"
        onClick={() => push('receive')}
        icon={
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
          >
            <line x1={12} y1={5} x2={12} y2={19} />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        }
      />

      {/* Buy -- disabled placeholder */}
      <ActionButton
        disabled
        label="Buy"
        icon={
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
          >
            <line x1={12} y1={5} x2={12} y2={19} />
            <line x1={5} y1={12} x2={19} y2={12} />
          </svg>
        }
      />
    </div>
  );
}
