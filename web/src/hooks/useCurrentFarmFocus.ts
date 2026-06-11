import { useSelectedFarm } from "./useSelectedFarm";
import { useGetMyFarmsQuery } from "@/store/api/farmsApi";

/**
 * The métier production focus (broiler/layer) of the currently selected farm
 * (Décision 17). An empty list means "no explicit focus" — callers should treat
 * it as "do not filter" rather than "nothing". Read from the cached farms list.
 */
export function useCurrentFarmFocus() {
  const { farmId, hasFarm } = useSelectedFarm();
  const { data: farms, isLoading } = useGetMyFarmsQuery();
  const focus = farms?.find((f) => f.id === farmId)?.productionFocus ?? [];
  return { focus, hasFarm, isLoading };
}
