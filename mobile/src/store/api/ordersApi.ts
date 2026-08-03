/**
 * Commercial orders — mirrors `web/src/store/api/ordersApi.ts` (same backend).
 * List/detail plus the workflow-advance actions (confirm, start preparation,
 * cancel). The happy path is PENDING → CONFIRMED → IN_PROGRESS → DELIVERED
 * (delivery creation is a separate flow); CANCELLED is terminal.
 */
import { baseApi } from './baseApi';
import type { Order, OrderStatus } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/orders`;

const orderTags = (id: number) =>
  [
    { type: 'Order', id },
    { type: 'Order', id: 'list' },
  ] as const;

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getOrders: build.query<Order[], { farmId: number; status?: OrderStatus; clientId?: number }>({
      query: ({ farmId, status, clientId }) => {
        const qs = new URLSearchParams();
        if (status) qs.set('status', status);
        if (clientId != null) qs.set('clientId', String(clientId));
        const s = qs.toString();
        return s ? `${base(farmId)}?${s}` : base(farmId);
      },
      transformResponse: (r: ApiEnvelope<Order[]>) => r.data,
      providesTags: [{ type: 'Order', id: 'list' }],
    }),
    getOrder: build.query<Order, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<Order>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: 'Order', id }],
    }),
    confirmOrder: build.mutation<Order, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/${id}/confirm`, method: 'POST' }),
      transformResponse: (r: ApiEnvelope<Order>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [...orderTags(id)],
    }),
    startOrderPreparation: build.mutation<Order, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/${id}/start-preparation`, method: 'POST' }),
      transformResponse: (r: ApiEnvelope<Order>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [...orderTags(id)],
    }),
    cancelOrder: build.mutation<Order, { farmId: number; id: number; reason?: string }>({
      query: ({ farmId, id, reason }) => ({
        url: `${base(farmId)}/${id}/cancel`,
        method: 'POST',
        body: { reason },
      }),
      transformResponse: (r: ApiEnvelope<Order>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [...orderTags(id)],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderQuery,
  useConfirmOrderMutation,
  useStartOrderPreparationMutation,
  useCancelOrderMutation,
} = ordersApi;
