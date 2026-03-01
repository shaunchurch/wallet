import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

interface OnboardingData {
  mnemonic: string | null;
  address: string | null;
}

interface OnboardingContextValue extends OnboardingData {
  setOnboardingData: (data: Partial<OnboardingData>) => void;
  clearOnboardingData: () => void;
}

const OnboardingCtx = createContext<OnboardingContextValue | undefined>(undefined);

const EMPTY: OnboardingData = { mnemonic: null, address: null };

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>(EMPTY);

  const setOnboardingData = useCallback(
    (partial: Partial<OnboardingData>) => setData((prev) => ({ ...prev, ...partial })),
    [],
  );

  const clearOnboardingData = useCallback(() => setData(EMPTY), []);

  const value = useMemo(
    () => ({ ...data, setOnboardingData, clearOnboardingData }),
    [data, setOnboardingData, clearOnboardingData],
  );

  return <OnboardingCtx value={value}>{children}</OnboardingCtx>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingCtx);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
