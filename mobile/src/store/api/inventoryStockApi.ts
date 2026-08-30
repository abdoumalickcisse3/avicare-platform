/**
 * Inventory / stock — ported from `web/src/store/api/inventoryStockApi.ts`
 * (same backend). Mobile keeps the field-relevant reads: the stock-item list,
 * the low-stock subset and the farm valuation total. Movements / thresholds /
 * soft-delete stay on the web; the mobile screen is read-only for now.
 *
 * Gated behind `module.inventory` on the backend (403 when inactive).
 */
import { baseApi } from './baseApi';
import type { StockItem, StockMovementInput, StockValuation } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory`;

export const inventoryStockApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getStockItems: build.query<StockItem[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/stock-items`,
      transformResponse: (r: ApiEnvelope<StockItem[]>) => r.data,
      providesTags: [{ type: 'StockItem', id: 'list' }],
    }),
    getLowStockItems: build.query<StockItem[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/stock-items/low-stock`,
      transformResponse: (r: ApiEnvelope<StockItem[]>) => r.data,
      providesTags: [{ type: 'StockItem', id: 'low-stock' }],
    }),
    getStockValuation: build.query<StockValuation, { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/stock-items/valuation`,
      transformResponse: (r: ApiEnvelope<StockValuation>) => r.data,
      providesTags: [{ type: 'StockItem', id: 'valuation' }],
    }),
    recordMovement: build.mutation<unknown, { farmId: number; body: StockMovementInput }>({
      // `/inventory/movements`, not `/inventory/stock-items/movements`: the second route does not
      // exist and every stock movement recorded from the app was failing. The unit test mocked the
      // mutation hook, so a wrong path stayed green — the offline queue had it right all along
      // (see `assistant/intentRegistry.ts`), which is why voice-dictated adjustments worked.
      query: ({ farmId, body }) => ({ url: `${base(farmId)}/movements`, method: 'POST', body }),
      invalidatesTags: [
        { type: 'StockItem', id: 'list' },
        { type: 'StockItem', id: 'low-stock' },
        { type: 'StockItem', id: 'valuation' },
        { type: 'InventoryAlert', id: 'farm' },
        { type: 'Dashboard', id: 'current' },
      ],
    }),
  }),
});

export const {
  useGetStockItemsQuery,
  useGetLowStockItemsQuery,
  useGetStockValuationQuery,
  useRecordMovementMutation,
} = inventoryStockApi;
