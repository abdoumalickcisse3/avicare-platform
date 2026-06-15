import { baseApi } from "./baseApi";
import type {
  InventoryAlerts,
  StockItem,
  StockMovement,
  StockMovementInput,
  StockValuation,
} from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory`;

/**
 * Stock module (Sprint B4) — stock items (read, low-stock, valuation, threshold,
 * notes, soft-delete), the append-only movement journal (by item / by lot / create)
 * and the compute-on-read inventory alerts. All gated behind {@code module.inventory}
 * on the backend; the frontend hides the area when inactive but the 403 stays the
 * real guarantee.
 */
export const inventoryStockApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /* --- Stock items --------------------------------------------------- */
    getStockItems: build.query<StockItem[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/stock-items`,
      transformResponse: (r: ApiEnvelope<StockItem[]>) => r.data,
      providesTags: [{ type: "StockItem", id: "list" }],
    }),
    getLowStockItems: build.query<StockItem[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/stock-items/low-stock`,
      transformResponse: (r: ApiEnvelope<StockItem[]>) => r.data,
      providesTags: [{ type: "StockItem", id: "low-stock" }],
    }),
    getStockItem: build.query<StockItem, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/stock-items/${id}`,
      transformResponse: (r: ApiEnvelope<StockItem>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: "StockItem", id }],
    }),
    getStockValuation: build.query<StockValuation, { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/stock-items/valuation`,
      transformResponse: (r: ApiEnvelope<StockValuation>) => r.data,
      providesTags: [{ type: "StockItem", id: "valuation" }],
    }),
    updateStockThreshold: build.mutation<
      StockItem,
      { farmId: number; id: number; threshold: number }
    >({
      query: ({ farmId, id, threshold }) => ({
        url: `${base(farmId)}/stock-items/${id}/threshold`,
        method: "PUT",
        body: { threshold },
      }),
      transformResponse: (r: ApiEnvelope<StockItem>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "StockItem", id },
        { type: "StockItem", id: "list" },
        { type: "StockItem", id: "low-stock" },
        { type: "InventoryAlert", id: "farm" },
      ],
    }),
    updateStockNotes: build.mutation<
      StockItem,
      { farmId: number; id: number; notes: string }
    >({
      query: ({ farmId, id, notes }) => ({
        url: `${base(farmId)}/stock-items/${id}/notes`,
        method: "PUT",
        body: { notes },
      }),
      transformResponse: (r: ApiEnvelope<StockItem>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "StockItem", id },
        { type: "StockItem", id: "list" },
      ],
    }),
    deactivateStockItem: build.mutation<void, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({
        url: `${base(farmId)}/stock-items/${id}/deactivate`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "StockItem", id },
        { type: "StockItem", id: "list" },
      ],
    }),

    /* --- Movements ----------------------------------------------------- */
    getMovementsByItem: build.query<
      StockMovement[],
      { farmId: number; stockItemId: number }
    >({
      query: ({ farmId, stockItemId }) =>
        `${base(farmId)}/movements?stockItemId=${stockItemId}`,
      transformResponse: (r: ApiEnvelope<StockMovement[]>) => r.data,
      providesTags: (_r, _e, { stockItemId }) => [
        { type: "StockMovement", id: stockItemId },
      ],
    }),
    getMovementsByLot: build.query<
      StockMovement[],
      { farmId: number; unitId: number }
    >({
      query: ({ farmId, unitId }) => `${base(farmId)}/movements/by-lot?unitId=${unitId}`,
      transformResponse: (r: ApiEnvelope<StockMovement[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [
        { type: "StockMovement", id: `lot-${unitId}` },
      ],
    }),
    recordMovement: build.mutation<
      StockMovement,
      { farmId: number; body: StockMovementInput }
    >({
      query: ({ farmId, body }) => ({
        url: `${base(farmId)}/movements`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<StockMovement>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: "StockMovement", id: body.stockItemId },
        { type: "StockItem", id: body.stockItemId },
        { type: "StockItem", id: "list" },
        { type: "StockItem", id: "low-stock" },
        { type: "StockItem", id: "valuation" },
        { type: "InventoryAlert", id: "farm" },
      ],
    }),

    /* --- Alerts -------------------------------------------------------- */
    getInventoryAlerts: build.query<InventoryAlerts, { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/alerts`,
      transformResponse: (r: ApiEnvelope<InventoryAlerts>) => r.data,
      providesTags: [{ type: "InventoryAlert", id: "farm" }],
    }),
  }),
});

export const {
  useGetStockItemsQuery,
  useGetLowStockItemsQuery,
  useGetStockItemQuery,
  useGetStockValuationQuery,
  useUpdateStockThresholdMutation,
  useUpdateStockNotesMutation,
  useDeactivateStockItemMutation,
  useGetMovementsByItemQuery,
  useGetMovementsByLotQuery,
  useRecordMovementMutation,
  useGetInventoryAlertsQuery,
} = inventoryStockApi;
