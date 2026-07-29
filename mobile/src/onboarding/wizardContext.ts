import { createContext, useContext } from 'react';

export type NextHandler = () => Promise<boolean> | boolean;

export interface WizardContextValue {
  farmId?: number;
  registerNext: (handler: NextHandler | null) => void;
  setCanAdvance: (can: boolean) => void;
}

export const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used inside the onboarding wizard');
  return ctx;
}
