import { useActiveModules } from "./useActiveModules";

export const MODULE_COMMERCIAL = "module.commercial.basic";

/**
 * Frontend mirror of the backend commercial gate. `hasCommercial` unlocks the
 * Commercial area (clients, orders, sales, deliveries, invoices, payments). This
 * only hides UI — the backend 403 stays the real authorization guarantee (no hard
 * route guard), same as {@link useInventoryGating}.
 */
export function useCommercialGating() {
  const { isModuleActive, isLoading, hasFarm, farmId } = useActiveModules();
  return {
    farmId,
    hasFarm,
    isLoading,
    hasCommercial: isModuleActive(MODULE_COMMERCIAL),
  };
}
