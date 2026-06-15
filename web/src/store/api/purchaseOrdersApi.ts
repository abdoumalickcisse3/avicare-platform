import { baseApi } from "./baseApi";
import type {
  PurchaseOrder,
  PurchaseOrderDraftInput,
  PurchaseOrderReceiveInput,
  PurchaseOrderStatus,
} from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/purchase-orders`;

const invalidateAll = [
  { type: "PurchaseOrder" as const, id: "list" },
  { type: "StockItem" as const, id: "list" },
  { type: "StockItem" as const, id: "valuation" },
  { type: "InventoryAlert" as const, id: "farm" },
];

/**
 * Purchase order workflow (Sprint B4): DRAFT → SENT → RECEIVED, plus cancel.
 * Reception cascades to stock on the backend, so receive invalidates stock tags.
 */
export const purchaseOrdersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPurchaseOrders: build.query<
      PurchaseOrder[],
      { farmId: number; status?: PurchaseOrderStatus }
    >({
      query: ({ farmId, status }) =>
        status ? `${base(farmId)}?status=${status}` : base(farmId),
      transformResponse: (r: ApiEnvelope<PurchaseOrder[]>) => r.data,
      providesTags: [{ type: "PurchaseOrder", id: "list" }],
    }),
    getPurchaseOrder: build.query<PurchaseOrder, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<PurchaseOrder>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: "PurchaseOrder", id }],
    }),
    createPurchaseOrder: build.mutation<
      PurchaseOrder,
      { farmId: number; body: PurchaseOrderDraftInput }
    >({
      query: ({ farmId, body }) => ({ url: base(farmId), method: "POST", body }),
      transformResponse: (r: ApiEnvelope<PurchaseOrder>) => r.data,
      invalidatesTags: [{ type: "PurchaseOrder", id: "list" }],
    }),
    updatePurchaseOrder: build.mutation<
      PurchaseOrder,
      { farmId: number; id: number; body: PurchaseOrderDraftInput }
    >({
      query: ({ farmId, id, body }) => ({
        url: `${base(farmId)}/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (r: ApiEnvelope<PurchaseOrder>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "PurchaseOrder", id },
        { type: "PurchaseOrder", id: "list" },
      ],
    }),
    submitPurchaseOrder: build.mutation<
      PurchaseOrder,
      { farmId: number; id: number }
    >({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/${id}/submit`, method: "POST" }),
      transformResponse: (r: ApiEnvelope<PurchaseOrder>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "PurchaseOrder", id },
        { type: "PurchaseOrder", id: "list" },
        { type: "InventoryAlert", id: "farm" },
      ],
    }),
    receivePurchaseOrder: build.mutation<
      PurchaseOrder,
      { farmId: number; id: number; body: PurchaseOrderReceiveInput }
    >({
      query: ({ farmId, id, body }) => ({
        url: `${base(farmId)}/${id}/receive`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<PurchaseOrder>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: "PurchaseOrder", id }, ...invalidateAll],
    }),
    cancelPurchaseOrder: build.mutation<
      PurchaseOrder,
      { farmId: number; id: number; reason?: string }
    >({
      query: ({ farmId, id, reason }) => ({
        url: `${base(farmId)}/${id}/cancel`,
        method: "POST",
        body: { reason },
      }),
      transformResponse: (r: ApiEnvelope<PurchaseOrder>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "PurchaseOrder", id },
        { type: "PurchaseOrder", id: "list" },
        { type: "InventoryAlert", id: "farm" },
      ],
    }),
  }),
});

export const {
  useGetPurchaseOrdersQuery,
  useGetPurchaseOrderQuery,
  useCreatePurchaseOrderMutation,
  useUpdatePurchaseOrderMutation,
  useSubmitPurchaseOrderMutation,
  useReceivePurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
} = purchaseOrdersApi;
