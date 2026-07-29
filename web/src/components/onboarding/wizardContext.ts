"use client";

import { createContext, useContext } from "react";

/**
 * A step's commit action. Runs when the user presses the footer CTA. Return
 * `true` to advance, `false` to stay (e.g. validation failed). May be async so a
 * step can persist to the API before moving on.
 */
export type NextHandler = () => Promise<boolean> | boolean;

export interface WizardContextValue {
  /** The farm being configured (created at signup). */
  farmId?: number;
  /** Register the current step's commit action (or `null` to just advance). */
  registerNext: (handler: NextHandler | null) => void;
  /** Enable/disable the footer CTA (validation gate). */
  setCanAdvance: (can: boolean) => void;
  /** Override the footer CTA label for this step. */
  setNextLabel: (label: string | null) => void;
}

export const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used inside <OnboardingWizard>");
  return ctx;
}
