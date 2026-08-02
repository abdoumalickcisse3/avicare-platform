import { renderHook } from '@testing-library/react-native';

jest.mock('@reduxjs/toolkit/query/react', () => ({ skipToken: Symbol('skipToken') }));

jest.mock('@/store/api/poultryBatchesApi', () => ({
  useGetBatchesQuery: jest.fn(() => ({
    data: [
      { id: 1, name: 'Lot A', currentCount: 480, status: 'ACTIVE' },
      { id: 2, name: null, currentCount: 0, status: 'ACTIVE' },
    ],
    isLoading: false,
  })),
}));
jest.mock('@/store/api/eggProductionApi', () => ({
  useGetTrayStockQuery: jest.fn(() => ({ data: { fullTraysCount: 12 }, isLoading: false })),
}));

import { useProductionAvailability } from '@/commerce/useProductionAvailability';

describe('useProductionAvailability', () => {
  it('keeps only broiler lots with heads and exposes egg trays', async () => {
    const { result } = await renderHook(() => useProductionAvailability(7));
    expect(result.current.broilerLots).toEqual([{ unitId: 1, label: 'Lot A', heads: 480 }]);
    expect(result.current.eggsAvailable).toBe(12);
    expect(result.current.loading).toBe(false);
  });
});
