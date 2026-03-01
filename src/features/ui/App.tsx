import { useEffect } from 'react';
import { type Screen, useWalletStore } from '../wallet/store';
import { OnboardingProvider } from './OnboardingContext';
import { AboutScreen } from './screens/AboutScreen';
import { ConfirmSeedScreen } from './screens/ConfirmSeedScreen';
import { CreatePasswordScreen } from './screens/CreatePasswordScreen';
import { ImportPasswordScreen } from './screens/ImportPasswordScreen';
import { ImportSeedScreen } from './screens/ImportSeedScreen';
import { LockScreen } from './screens/LockScreen';
import { MainScreen } from './screens/MainScreen';
import { ReceiveScreen } from './screens/ReceiveScreen';
import { SeedPhraseScreen } from './screens/SeedPhraseScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { ThemeProvider } from './ThemeProvider';

const screens: Record<Screen, React.ComponentType> = {
  loading: LoadingScreen,
  welcome: WelcomeScreen,
  'create-password': CreatePasswordScreen,
  'seed-phrase': SeedPhraseScreen,
  'confirm-seed': ConfirmSeedScreen,
  'import-seed': ImportSeedScreen,
  'import-password': ImportPasswordScreen,
  main: MainScreen,
  receive: ReceiveScreen,
  lock: LockScreen,
  settings: SettingsScreen,
  about: AboutScreen,
};

function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />
    </div>
  );
}

export function App() {
  const currentScreen = useWalletStore((s) => s.currentScreen);
  const initialize = useWalletStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const ScreenComponent = screens[currentScreen];

  return (
    <ThemeProvider>
      <OnboardingProvider>
        <div className="flex h-[600px] w-[360px] flex-col overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
          <ScreenComponent />
        </div>
      </OnboardingProvider>
    </ThemeProvider>
  );
}
