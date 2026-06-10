import { useCallback, useMemo } from "react";
import { useSelectedFarm } from "./useSelectedFarm";
import { useGetSubscriptionQuery } from "@/store/api/subscriptionApi";
import type { Subscription } from "@/types";

/**
 * Active module keys from a subscription: those activated in HARD mode and not
 * past their expiry. Pure (no hooks) so it can be unit-tested in isolation.
 *
 * Note: this reflects the REAL subscription state, independent of the ADR-004
 * dev gating bypass — the bypass controls route access (no 403), not which
 * modules a farm has subscribed to, so the sidebar stays driven by real data.
 */
export function computeActiveModules(sub: Subscription | undefined): string[] {
  if (!sub) return [];
  const now = Date.now();
  return sub.modules
    .filter(
      (m) =>
        m.mode === "HARD" &&
        (!m.expiresAt || new Date(m.expiresAt).getTime() > now),
    )
    .map((m) => m.moduleKey);
}

/**
 * Modules active on the currently selected farm's subscription, with a helper to
 * test a single key. Used to filter the sidebar's Élevage items.
 */
export function useActiveModules() {
  const { farmId, isLoading: farmLoading, hasFarm } = useSelectedFarm();
  const { data: subscription, isLoading: subLoading } = useGetSubscriptionQuery(
    farmId as number,
    { skip: !hasFarm },
  );

  const activeModules = useMemo(
    () => computeActiveModules(subscription),
    [subscription],
  );
  const isModuleActive = useCallback(
    (key: string) => activeModules.includes(key),
    [activeModules],
  );

  return {
    farmId,
    hasFarm,
    isLoading: farmLoading || (hasFarm && subLoading),
    activeModules,
    isModuleActive,
  };
}
