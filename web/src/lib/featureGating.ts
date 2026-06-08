import type { BundleKey } from "@/constants/bundles";

/**
 * Dev-only mirror of the backend `avicare.features.gating-enabled=false` switch
 * (ADR-004). When `NEXT_PUBLIC_FEATURES_GATING=off`, the UI removes subscription
 * friction: the signup wizard auto-picks a full bundle and skips the plan step,
 * and the dashboard hides the trial "choose a plan" nudge.
 *
 * Default (unset) keeps the full gating UX, so production builds are unaffected
 * unless the variable is explicitly set. Read as a function so it stays testable
 * (Vitest can stub the env var).
 */
export function isFeatureGatingDisabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURES_GATING === "off";
}

/** Bundle auto-selected when gating is disabled (every V1 module enabled). */
export const DEV_BYPASS_BUNDLE_KEY: BundleKey = "complete";
