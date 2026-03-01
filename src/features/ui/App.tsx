import { useEffect, useRef } from 'react';
import { sendWalletMessage } from '../wallet/messages';
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
import { SendAmountScreen } from './screens/SendAmountScreen';
import { SendConfirmScreen } from './screens/SendConfirmScreen';
import { SendRecipientScreen } from './screens/SendRecipientScreen';
import { SendResultScreen } from './screens/SendResultScreen';
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
  'send-recipient': SendRecipientScreen,
  'send-amount': SendAmountScreen,
  'send-confirm': SendConfirmScreen,
  'send-result': SendResultScreen,
};

function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="size-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />
    </div>
  );
}

const HEARTBEAT_THROTTLE_MS = 60_000;

export function App() {
  const currentScreen = useWalletStore((s) => s.currentScreen);
  const initialize = useWalletStore((s) => s.initialize);
  const lastHeartbeat = useRef(0);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // SEC-08: Throttled heartbeat resets auto-lock alarm on user interaction
  useEffect(() => {
    function onActivity() {
      const now = Date.now();
      if (now - lastHeartbeat.current < HEARTBEAT_THROTTLE_MS) return;
      lastHeartbeat.current = now;
      sendWalletMessage({ type: 'wallet:heartbeat' }).catch(() => {
        // Ignore -- background may be restarting
      });
    }
    document.addEventListener('click', onActivity);
    document.addEventListener('keydown', onActivity);
    document.addEventListener('scroll', onActivity, true);
    return () => {
      document.removeEventListener('click', onActivity);
      document.removeEventListener('keydown', onActivity);
      document.removeEventListener('scroll', onActivity, true);
    };
  }, []);

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
