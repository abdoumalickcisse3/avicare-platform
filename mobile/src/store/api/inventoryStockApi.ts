/**
 * Inventory / stock — ported from `web/src/store/api/inventoryStockApi.ts`
 * (same backend). Mobile keeps the field-relevant reads: the stock-item list,
 * the low-stock subset and the farm valuation total. Movements / thresholds /
 * soft-delete stay on the web; the mobile screen is read-only for now.
 *
 * Gated behind `module.inventory` on the backend (403 when inactive).
 */
import { baseApi } from './baseApi';
import type {
  InventoryAlerts,
  StockItem,
  StockMovement,
  StockMovementInput,
  StockValuation,
} from '@/types';

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

    /**
     * The farm's stock alerts in one read: low stock, negative stock, purchase orders still
     * waiting, recent movements.
     *
     * <p>The screen already showed low stock. Negative stock is the one that matters most and had
     * nowhere to appear: a count below zero is not a shortage, it is a bookkeeping error — an exit
     * recorded twice, an entry never recorded — and every figure computed from that article is
     * wrong until someone corrects it.
     */
    getInventoryAlerts: build.query<InventoryAlerts, { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/alerts`,
      transformResponse: (r: ApiEnvelope<InventoryAlerts>) => r.data,
      providesTags: [{ type: 'StockItem', id: 'alerts' }],
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
    /** One article's stock row — the detail screen's spine. */
    getStockItem: build.query<StockItem, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/stock-items/${id}`,
      transformResponse: (r: ApiEnvelope<StockItem>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: 'StockItem', id }],
    }),

    /**
     * The ledger for one article. Every movement carries `quantityBefore` and `quantityAfter`,
     * so the history reads as a running balance rather than a list of deltas to add up.
     */
    getMovementsByItem: build.query<StockMovement[], { farmId: number; stockItemId: number }>({
      query: ({ farmId, stockItemId }) => `${base(farmId)}/movements?stockItemId=${stockItemId}`,
      transformResponse: (r: ApiEnvelope<StockMovement[]>) => r.data,
      providesTags: (_r, _e, { stockItemId }) => [{ type: 'StockMovement', id: stockItemId }],
    }),

    /** What one flock has consumed — the D18 cross-context coupling, read back. */
    getMovementsByLot: build.query<StockMovement[], { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => `${base(farmId)}/movements/by-lot?unitId=${unitId}`,
      transformResponse: (r: ApiEnvelope<StockMovement[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'StockMovement', id: `lot-${unitId}` }],
    }),

    updateStockThreshold: build.mutation<
      StockItem,
      { farmId: number; id: number; threshold: number }
    >({
      query: ({ farmId, id, threshold }) => ({
        url: `${base(farmId)}/stock-items/${id}/threshold`,
        method: 'PUT',
        body: { threshold },
      }),
      transformResponse: (r: ApiEnvelope<StockItem>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'StockItem', id },
        { type: 'StockItem', id: 'list' },
        { type: 'StockItem', id: 'low-stock' },
        { type: 'InventoryAlert', id: 'farm' },
      ],
    }),

    updateStockNotes: build.mutation<StockItem, { farmId: number; id: number; notes: string }>({
      query: ({ farmId, id, notes }) => ({
        url: `${base(farmId)}/stock-items/${id}/notes`,
        method: 'PUT',
        body: { notes },
      }),
      transformResponse: (r: ApiEnvelope<StockItem>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'StockItem', id },
        { type: 'StockItem', id: 'list' },
      ],
    }),

    /** Archives the row; the movements it accumulated stay readable. */
    deactivateStockItem: build.mutation<void, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({
        url: `${base(farmId)}/stock-items/${id}/deactivate`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'StockItem', id },
        { type: 'StockItem', id: 'list' },
      ],
    }),
  }),
});

export const {
  useGetStockItemsQuery,
  useGetLowStockItemsQuery,
  useGetStockValuationQuery,
  useGetInventoryAlertsQuery,
  useGetStockItemQuery,
  useGetMovementsByItemQuery,
  useGetMovementsByLotQuery,
  useRecordMovementMutation,
  useUpdateStockThresholdMutation,
  useUpdateStockNotesMutation,
  useDeactivateStockItemMutation,
} = inventoryStockApi;
