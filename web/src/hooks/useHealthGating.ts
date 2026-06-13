import { useActiveModules } from "./useActiveModules";

export const HEALTH_BASIC = "module.health.basic";
export const HEALTH_ADVANCED = "module.health.advanced";

/**
 * Frontend mirror of the backend health module split. `hasBasic` unlocks
 * vaccinations, observations and vaccination programs; `hasAdvanced` adds
 * treatments, the vet directory and vet visits. This only hides UI — the
 * backend 403 (ADR-004 aside) remains the real authorization guarantee, so no
 * route is hard-guarded here.
 */
export function useHealthGating() {
  const { isModuleActive, isLoading, hasFarm, farmId } = useActiveModules();
  const hasBasic = isModuleActive(HEALTH_BASIC);
  const hasAdvanced = isModuleActive(HEALTH_ADVANCED);
  return {
    farmId,
    hasFarm,
    isLoading,
    hasBasic,
    hasAdvanced,
    // Health area is reachable when either tier is active.
    hasHealth: hasBasic || hasAdvanced,
  };
}
