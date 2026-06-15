import { useActiveModules } from "./useActiveModules";

export const MODULE_INVENTORY = "module.inventory";

/**
 * Frontend mirror of the backend inventory gate. `hasInventory` unlocks the
 * Stocks area and the optional D18 stock-coupling section in the daily-record,
 * vaccination and treatment dialogs. This only hides UI — the backend 403/422
 * stays the real authorization guarantee (no hard route guard).
 */
export function useInventoryGating() {
  const { isModuleActive, isLoading, hasFarm, farmId } = useActiveModules();
  return {
    farmId,
    hasFarm,
    isLoading,
    hasInventory: isModuleActive(MODULE_INVENTORY),
  };
}
