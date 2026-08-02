/**
 * The selected farm's production focus tokens ("broiler" / "layer"), mirroring
 * the web `useCurrentFarmFocus`. Drives the Élevage nav filtering (Décision 17):
 * a broiler-only farm doesn't see the Œufs page, and vice-versa. Empty = no
 * declared focus → show everything (same rule as the web sidebar).
 */
import { useSelector } from 'react-redux';
import { useListFarmsQuery } from '@/store/api/farmsApi';
import { selectSelectedFarmId } from '@/store/slices/selectionSlice';

export function useCurrentFarmFocus(): string[] {
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const { data: farms } = useListFarmsQuery();
  return farms?.find((f) => f.id === selectedFarmId)?.productionFocus ?? [];
}
