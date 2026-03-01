import { ActionButtons } from '../components/ActionButtons';
import { BalancePlaceholder } from '../components/BalancePlaceholder';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';

export function MainScreen() {
  return (
    <>
      <Header />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <BalancePlaceholder />
        <ActionButtons />

        {/* Token area -- placeholder for Phase 8 */}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border-t border-zinc-200 px-4 py-8 dark:border-zinc-800">
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-8 text-zinc-300 dark:text-zinc-700"
          >
            <circle cx={12} cy={12} r={10} />
            <line x1={12} y1={8} x2={12} y2={16} />
            <line x1={8} y1={12} x2={16} y2={12} />
          </svg>
          <p className="text-sm text-zinc-400 dark:text-zinc-600">No tokens yet</p>
        </div>
      </div>
      <Sidebar />
    </>
  );
}
