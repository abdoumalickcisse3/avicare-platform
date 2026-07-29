export const ONBOARDING_STEPS = [
  { id: 'welcome', label: 'Bienvenue' },
  { id: 'farm', label: 'Votre ferme' },
  { id: 'livestock', label: 'Élevage' },
  { id: 'stock', label: 'Stock' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'finance', label: 'Finance' },
  { id: 'done', label: "C'est prêt" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];

export const WELCOME_PENDING_KEY = 'jawdi.welcomePending';
