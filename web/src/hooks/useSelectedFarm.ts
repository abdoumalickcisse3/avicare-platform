import { useAppSelector } from "@/store/hooks";
import { useGetMyFarmsQuery } from "@/store/api/farmsApi";

/**
 * Resolve the farm the poultry pages operate on: the selected farm (uiSlice) if set,
 * otherwise the user's first farm. There is no global farm selector yet, so the first
 * farm is the V1 default.
 */
export function useSelectedFarm() {
  const selectedFarmId = useAppSelector((s) => s.ui.selectedFarmId);
  const { data: farms, isLoading } = useGetMyFarmsQuery();
  const farmId =
    selectedFarmId ?? (farms && farms.length > 0 ? farms[0].id : undefined);
  return { farmId, isLoading, hasFarm: farmId !== undefined };
}
