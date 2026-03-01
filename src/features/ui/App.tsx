import { ActionButtons } from './components/ActionButtons';
import { BalancePlaceholder } from './components/BalancePlaceholder';
import { Header } from './components/Header';
import { ThemeProvider } from './ThemeProvider';

export function App() {
  return (
    <ThemeProvider>
      <div className="flex h-[600px] w-[360px] flex-col overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <Header />
        <BalancePlaceholder />
        <ActionButtons />
      </div>
    </ThemeProvider>
  );
}
