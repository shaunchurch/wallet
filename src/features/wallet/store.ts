import { create } from 'zustand';
import { sendWalletMessage } from './messages';
import type { DerivedAccount } from './types';

export type Screen =
  | 'loading'
  | 'welcome'
  | 'create-password'
  | 'seed-phrase'
  | 'confirm-seed'
  | 'import-seed'
  | 'import-password'
  | 'main'
  | 'receive'
  | 'lock'
  | 'settings'
  | 'about';

interface WalletStore {
  // Navigation
  screenStack: Screen[];
  currentScreen: Screen;
  push: (screen: Screen) => void;
  pop: () => void;
  replace: (screen: Screen) => void;
  reset: (screen: Screen) => void;

  // Wallet state
  isLocked: boolean;
  accounts: DerivedAccount[];
  activeAccountIndex: number;
  network: 'mainnet' | 'testnet';
  autoLockMinutes: number;
  sidebarOpen: boolean;
  accountNames: Record<number, string>;

  // Actions
  initialize: () => Promise<void>;
  setAccounts: (accounts: DerivedAccount[]) => void;
  setActiveAccount: (index: number) => void;
  setNetwork: (network: 'mainnet' | 'testnet') => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  loadAccountNames: () => Promise<void>;
  setAccountName: (index: number, name: string) => void;
}

export const useWalletStore = create<WalletStore>()((set, get) => ({
  // Navigation
  screenStack: ['loading'],
  currentScreen: 'loading',

  push: (screen) =>
    set((s) => ({
      screenStack: [...s.screenStack, screen],
      currentScreen: screen,
    })),

  pop: () =>
    set((s) => {
      const stack = s.screenStack.slice(0, -1);
      return {
        screenStack: stack.length ? stack : ['welcome'],
        currentScreen: stack[stack.length - 1] ?? 'welcome',
      };
    }),

  replace: (screen) =>
    set((s) => ({
      screenStack: [...s.screenStack.slice(0, -1), screen],
      currentScreen: screen,
    })),

  reset: (screen) =>
    set(() => ({
      screenStack: [screen],
      currentScreen: screen,
    })),

  // Wallet state
  isLocked: true,
  accounts: [],
  activeAccountIndex: 0,
  network: 'mainnet',
  autoLockMinutes: 15,
  sidebarOpen: false,
  accountNames: {},

  // Actions
  initialize: async () => {
    // Start on loading
    set({ currentScreen: 'loading', screenStack: ['loading'] });

    // Check if vault exists
    const result = await chrome.storage.local.get('vault');
    if (!result.vault) {
      set({ currentScreen: 'welcome', screenStack: ['welcome'], isLocked: false });
      return;
    }

    // Vault exists -- check if session is unlocked
    const resp = await sendWalletMessage({ type: 'wallet:getAccounts' });
    if (resp.type === 'wallet:accounts') {
      // Load persisted preferences
      const stored = await chrome.storage.local.get(['network', 'autoLockMinutes', 'activeAccountIndex']);
      const network = stored.network === 'testnet' ? 'testnet' : 'mainnet';
      const autoLockMinutes =
        typeof stored.autoLockMinutes === 'number' ? stored.autoLockMinutes : 15;
      const activeAccountIndex =
        typeof stored.activeAccountIndex === 'number' &&
        stored.activeAccountIndex < resp.accounts.length
          ? stored.activeAccountIndex
          : 0;
      set({
        isLocked: false,
        accounts: resp.accounts,
        activeAccountIndex,
        network,
        autoLockMinutes,
        currentScreen: 'main',
        screenStack: ['main'],
      });
      // Load account names after setting accounts
      get().loadAccountNames();
    } else {
      set({ isLocked: true, currentScreen: 'lock', screenStack: ['lock'] });
    }
  },

  setAccounts: (accounts) => set({ accounts }),
  setActiveAccount: (index) => {
    set({ activeAccountIndex: index });
    chrome.storage.local.set({ activeAccountIndex: index });
  },
  setNetwork: (network) => {
    set({ network });
    chrome.storage.local.set({ network });
  },
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),

  loadAccountNames: async () => {
    const result = await chrome.storage.local.get('accountNames');
    if (result.accountNames) {
      set({ accountNames: result.accountNames as Record<number, string> });
    }
  },

  setAccountName: (index, name) => {
    const updated = { ...get().accountNames, [index]: name };
    set({ accountNames: updated });
    chrome.storage.local.set({ accountNames: updated });
  },
}));
