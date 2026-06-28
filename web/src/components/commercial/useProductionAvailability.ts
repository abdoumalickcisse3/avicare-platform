import { useGetBatchesQuery } from "@/store/api/poultryBatchesApi";
import { useGetTrayStockQuery } from "@/store/api/eggProductionApi";

export interface BroilerLotOption {
  unitId: number;
  label: string;
  heads: number;
}

/**
 * Returns vendable production options for a farm:
 * - broilerLots: ACTIVE batches with currentCount > 0
 * - eggsAvailable: fullTraysCount from the farm tray-stock (0 if unavailable)
 * - loading: true while either query is in flight
 */
export function useProductionAvailability(farmId: number): {
  broilerLots: BroilerLotOption[];
  eggsAvailable: number;
  loading: boolean;
} {
  const { data: batches, isLoading: batchesLoading } = useGetBatchesQuery({
    farmId,
    status: "ACTIVE",
  });
  const { data: trayStock, isLoading: trayLoading } = useGetTrayStockQuery({ farmId });

  const broilerLots: BroilerLotOption[] = (batches ?? [])
    .filter((b) => b.status === "ACTIVE" && b.currentCount > 0)
    .map((b) => ({
      unitId: b.id,
      label: b.name ?? `Lot #${b.id}`,
      heads: b.currentCount,
    }));

  const eggsAvailable = trayStock?.fullTraysCount ?? 0;
  const loading = batchesLoading || trayLoading;

  return { broilerLots, eggsAvailable, loading };
}
