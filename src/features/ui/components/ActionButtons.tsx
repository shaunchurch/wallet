import { Button } from '@/components/ui/button';

export function ActionButtons() {
  return (
    <div className="flex w-full gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
      <Button
        className="flex-1 bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
        disabled
      >
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
          <line x1={12} y1={5} x2={12} y2={19} />
          <polyline points="19 12 12 19 5 12" />
        </svg>
        Send
      </Button>
      <Button
        className="flex-1 bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
        disabled
      >
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
          <line x1={12} y1={19} x2={12} y2={5} />
          <polyline points="5 12 12 5 19 12" />
        </svg>
        Receive
      </Button>
    </div>
  );
}
