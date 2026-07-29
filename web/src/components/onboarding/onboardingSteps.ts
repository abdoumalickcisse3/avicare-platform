/**
 * The seven onboarding steps, in order. Numbering is meaningful — this is a real
 * sequence the farm owner walks through once, so the rail shows 1…7.
 */
export const ONBOARDING_STEPS = [
  { id: "welcome", label: "Bienvenue" },
  { id: "farm", label: "Votre ferme" },
  { id: "livestock", label: "Élevage" },
  { id: "stock", label: "Stock" },
  { id: "commercial", label: "Commercial" },
  { id: "finance", label: "Finance" },
  { id: "done", label: "C'est prêt" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

/** localStorage flag: set on the last step, read once by the dashboard to fire
 * the welcome popup + guided tour on first arrival. */
export const WELCOME_PENDING_KEY = "jawdi_welcome_pending";
