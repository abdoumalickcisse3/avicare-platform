"use client";

import { useState } from "react";
import { WELCOME_PENDING_KEY } from "./onboardingSteps";
import { WelcomeModal } from "./WelcomeModal";
import { DashboardTour } from "./DashboardTour";

type Phase = "idle" | "modal" | "tour";

/**
 * First-run orchestration on the dashboard: if the onboarding wizard set the
 * welcome-pending flag, show the welcome popup, then (on "Commencer") the guided
 * tour. The flag is cleared the first time either path completes, so this runs
 * exactly once per new owner. Mounted inside the dashboard so tour targets exist.
 */
export function DashboardWelcome() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [checked, setChecked] = useState(false);

  // Read the first-run flag once, on the client, during render (guarded so it
  // runs a single time and never on the server) — avoids an effect-driven
  // cascade while staying SSR-safe (the popup/tour render nothing until set).
  if (!checked && typeof window !== "undefined") {
    setChecked(true);
    try {
      if (localStorage.getItem(WELCOME_PENDING_KEY) === "1") setPhase("modal");
    } catch {
      // storage unavailable — skip the first-run flow silently.
    }
  }

  const clearFlag = () => {
    try {
      localStorage.removeItem(WELCOME_PENDING_KEY);
    } catch {
      // ignore
    }
  };

  const skip = () => {
    clearFlag();
    setPhase("idle");
  };

  const startTour = () => setPhase("tour");

  const finishTour = () => {
    clearFlag();
    setPhase("idle");
  };

  return (
    <>
      <WelcomeModal open={phase === "modal"} onStart={startTour} onSkip={skip} />
      <DashboardTour run={phase === "tour"} onDone={finishTour} />
    </>
  );
}
