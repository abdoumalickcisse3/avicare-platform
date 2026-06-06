import type { Farm } from "@/types";

export type WizardStep = 1 | 2 | 3;

/**
 * What the wizard should do on mount, given the user's current state. Kept pure
 * so the resume robustness can be unit-tested in isolation:
 * - onboarding already done  → redirect to the dashboard
 * - no farm yet              → start at step 1 (create exploitation)
 * - farm but no active module → resume at step 2 (choose a bundle)
 * - farm + active modules     → resume at step 3 (first batch / finish)
 */
export type ResumeDecision =
  | { kind: "completed" }
  | { kind: "step"; step: WizardStep; farmId?: number };

export function decideResume(args: {
  onboardingCompleted: boolean;
  farms: Farm[];
  activeModuleCount: number;
}): ResumeDecision {
  const { onboardingCompleted, farms, activeModuleCount } = args;

  if (onboardingCompleted) return { kind: "completed" };
  if (farms.length === 0) return { kind: "step", step: 1 };

  const farmId = farms[0].id;
  if (activeModuleCount > 0) return { kind: "step", step: 3, farmId };
  return { kind: "step", step: 2, farmId };
}
