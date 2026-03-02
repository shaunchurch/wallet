import { Header } from '../components/Header';

export function DappSignScreen() {
  return (
    <>
      <Header />
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-zinc-400">Loading...</span>
      </div>
    </>
  );
}
