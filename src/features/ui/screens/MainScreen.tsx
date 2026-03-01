import { ActionButtons } from '../components/ActionButtons';
import { BalancePlaceholder } from '../components/BalancePlaceholder';
import { Header } from '../components/Header';

export function MainScreen() {
  return (
    <>
      <Header />
      <BalancePlaceholder />
      <ActionButtons />
    </>
  );
}
