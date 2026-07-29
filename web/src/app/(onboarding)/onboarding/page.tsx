"use client";

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

/**
 * Post-signup guided setup. The account + farm already exist; the wizard walks
 * the owner through configuring the farm and each module with pre-filled
 * platform defaults, then hands off to the dashboard (welcome popup + tour).
 */
export default function OnboardingPage() {
  return <OnboardingWizard />;
}
