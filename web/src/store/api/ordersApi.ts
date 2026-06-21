import { baseApi } from "./baseApi";
import type { Order, OrderInput, OrderStatus } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/orders`;

const listTags = [{ type: "Order" as const, id: "list" }];

/**
 * Sales order workflow (Sprint B5-6c): the strict 5-state machine (D23). Field
 * transitions (confirm, start-preparation) and creation are mutations; the
 * DELIVERED transition happens through the deliveries API.
 */
export const ordersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getOrders: build.query<Order[], { farmId: number; status?: OrderStatus; clientId?: number }>({
      query: ({ farmId, status, clientId }) => {
        const p = new URLSearchParams();
        if (status) p.set("status", status);
        if (clientId != null) p.set("clientId", String(clientId));
        const qs = p.toString();
        return qs ? `${base(farmId)}?${qs}` : base(farmId);
      },
      transformResponse: (r: ApiEnvelope<Order[]>) => r.data,
      providesTags: listTags,
    }),
    getOrder: build.query<Order, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<Order>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: "Order", id }],
    }),
    createOrder: build.mutation<Order, { farmId: number; body: OrderInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: "POST", body }),
      transformResponse: (r: ApiEnvelope<Order>) => r.data,
      invalidatesTags: listTags,
    }),
    confirmOrder: build.mutation<Order, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/${id}/confirm`, method: "POST" }),
      transformResponse: (r: ApiEnvelope<Order>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: "Order", id }, ...listTags],
    }),
    startOrderPreparation: build.mutation<Order, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/${id}/start-preparation`, method: "POST" }),
      transformResponse: (r: ApiEnvelope<Order>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: "Order", id }, ...listTags],
    }),
    cancelOrder: build.mutation<Order, { farmId: number; id: number; reason?: string }>({
      query: ({ farmId, id, reason }) => ({
        url: `${base(farmId)}/${id}/cancel`,
        method: "POST",
        body: { reason },
      }),
      transformResponse: (r: ApiEnvelope<Order>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [{ type: "Order", id }, ...listTags],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useGetOrderQuery,
  useCreateOrderMutation,
  useConfirmOrderMutation,
  useStartOrderPreparationMutation,
  useCancelOrderMutation,
} = ordersApi;
