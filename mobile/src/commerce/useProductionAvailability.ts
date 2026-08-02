/**
 * Production available to sell in the "Vente directe" cart — mobile port of the
 * web `useProductionAvailability`. Broiler lots with heads left + the farm's egg
 * tray stock, both from the existing production slices.
 */
import { skipToken } from '@reduxjs/toolkit/query/react';
import { useGetBatchesQuery } from '@/store/api/poultryBatchesApi';
import { useGetTrayStockQuery } from '@/store/api/eggProductionApi';

export interface BroilerLotOption {
  unitId: number;
  label: string;
  heads: number;
}

export function useProductionAvailability(farmId: number | null): {
  broilerLots: BroilerLotOption[];
  eggsAvailable: number;
  loading: boolean;
} {
  const arg = farmId === null ? skipToken : { farmId };
  const { data: batches, isLoading: loadingBatches } = useGetBatchesQuery(arg);
  const { data: trays, isLoading: loadingTrays } = useGetTrayStockQuery(arg);

  const broilerLots: BroilerLotOption[] = (batches ?? [])
    .filter((b) => b.currentCount > 0)
    .map((b) => ({ unitId: b.id, label: b.name ?? `Lot #${b.id}`, heads: b.currentCount }));

  return {
    broilerLots,
    eggsAvailable: trays?.fullTraysCount ?? 0,
    loading: loadingBatches || loadingTrays,
  };
}
