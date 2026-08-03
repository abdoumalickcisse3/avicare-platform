/**
 * Purchase orders — mirrors `web/src/store/api/purchaseOrdersApi.ts`. Buy stock
 * (feed, etc.) from a supplier: create (DRAFT) → submit (SENT) → receive
 * (RECEIVED, which cascades IN stock movements) or cancel. Gated
 * `module.inventory`.
 */
import { baseApi } from './baseApi';
import type { PurchaseOrder, PurchaseOrderInput, PurchaseOrderReceiveInput, PurchaseOrderStatus } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/purchase-orders`;

// Receiving/cancelling touches stock levels, alerts and the dashboard.
const stockTags = [
  { type: 'PurchaseOrder', id: 'list' },
  { type: 'StockItem', id: 'list' },
  { type: 'StockItem', id: 'low-stock' },
  { type: 'StockItem', id: 'valuation' },
  { type: 'InventoryAlert', id: 'farm' },
  { type: 'Dashboard', id: 'current' },
] as const;

export const purchaseOrdersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPurchaseOrders: build.query<PurchaseOrder[], { farmId: number; status?: PurchaseOrderStatus }>({
      query: ({ farmId, status }) => (status ? `${base(farmId)}?status=${status}` : base(farmId)),
      transformResponse: (r: ApiEnvelope<PurchaseOrder[]>) => r.data,
      providesTags: [{ type: 'PurchaseOrder', id: 'list' }],
    }),
    getPurchaseOrder: build.query<PurchaseOrder, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<PurchaseOrder>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: 'PurchaseOrder', id }],
    }),
    createPurchaseOrder: build.mutation<PurchaseOrder, { farmId: number; body: PurchaseOrderInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<PurchaseOrder>) => r.data,
      invalidatesTags: [{ type: 'PurchaseOrder', id: 'list' }],
    }),
    submitPurchaseOrder: build.mutation<PurchaseOrder, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/${id}/submit`, method: 'POST' }),
      transformResponse: (r: ApiEnvelope<PurchaseOrder>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'PurchaseOrder', id }, { type: 'PurchaseOrder', id: 'list' }],
    }),
    receivePurchaseOrder: build.mutation<PurchaseOrder, { farmId: number; id: number; body: PurchaseOrderReceiveInput }>({
      query: ({ farmId, id, body }) => ({ url: `${base(farmId)}/${id}/receive`, method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<PurchaseOrder>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'PurchaseOrder', id }, ...stockTags],
    }),
    cancelPurchaseOrder: build.mutation<PurchaseOrder, { farmId: number; id: number; reason?: string }>({
      query: ({ farmId, id, reason }) => ({ url: `${base(farmId)}/${id}/cancel`, method: 'POST', body: { reason } }),
      transformResponse: (r: ApiEnvelope<PurchaseOrder>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'PurchaseOrder', id }, { type: 'PurchaseOrder', id: 'list' }],
    }),
  }),
});

export const {
  useGetPurchaseOrdersQuery,
  useGetPurchaseOrderQuery,
  useCreatePurchaseOrderMutation,
  useSubmitPurchaseOrderMutation,
  useReceivePurchaseOrderMutation,
  useCancelPurchaseOrderMutation,
} = purchaseOrdersApi;
