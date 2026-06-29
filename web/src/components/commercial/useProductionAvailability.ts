import { useGetBatchesQuery } from "@/store/api/poultryBatchesApi";
import { useGetTrayStockQuery } from "@/store/api/eggProductionApi";
import { useGetBreedsQuery } from "@/store/api/breedsApi";

export interface BroilerLotOption {
  unitId: number;
  label: string;
  heads: number;
}

/**
 * Returns vendable production options for a farm:
 * - broilerLots: ACTIVE meat lots with currentCount > 0. Layer lots are excluded
 *   (their breed.type === "layer") — those produce eggs, not sellable heads here;
 *   their eggs feed the farm tray stock instead.
 * - eggsAvailable: fullTraysCount from the farm tray-stock (0 if unavailable)
 * - loading: true while any query is in flight
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
  const { data: breeds, isLoading: breedsLoading } = useGetBreedsQuery({ species: "POULTRY" });

  const layerBreedIds = new Set(
    (breeds ?? []).filter((br) => br.type === "layer").map((br) => br.id),
  );

  const broilerLots: BroilerLotOption[] = (batches ?? [])
    .filter(
      (b) => b.status === "ACTIVE" && b.currentCount > 0 && !layerBreedIds.has(b.breedId),
    )
    .map((b) => ({
      unitId: b.id,
      label: b.name ?? `Lot #${b.id}`,
      heads: b.currentCount,
    }));

  const eggsAvailable = trayStock?.fullTraysCount ?? 0;
  const loading = batchesLoading || trayLoading || breedsLoading;

  return { broilerLots, eggsAvailable, loading };
}
