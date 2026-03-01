export function BalancePlaceholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
      <div className="flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <span className="font-mono">0x0000...0000</span>
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3 opacity-50"
        >
          <rect width={14} height={14} x={8} y={8} rx={2} ry={2} />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      </div>

      <p className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">0.00 ETH</p>
      <p className="text-lg text-zinc-400 dark:text-zinc-500">$0.00</p>
    </div>
  );
}
