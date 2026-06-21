import { baseApi } from "./baseApi";
import type { Delivery, DeliveryFromOrderInput, DeliveryStatus } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/deliveries`;

/**
 * Deliveries (Sprint B5-6c): created by converting a confirmed order, which marks
 * the order DELIVERED and decrements stock (D21). Cancel reverses both. Mutations
 * invalidate orders and stock tags accordingly.
 */
export const deliveriesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDeliveries: build.query<Delivery[], { farmId: number; status?: DeliveryStatus }>({
      query: ({ farmId, status }) => (status ? `${base(farmId)}?status=${status}` : base(farmId)),
      transformResponse: (r: ApiEnvelope<Delivery[]>) => r.data,
      providesTags: [{ type: "Delivery", id: "list" }],
    }),
    getDelivery: build.query<Delivery, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<Delivery>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: "Delivery", id }],
    }),
    createDeliveryFromOrder: build.mutation<
      Delivery,
      { farmId: number; body: DeliveryFromOrderInput }
    >({
      query: ({ farmId, body }) => ({ url: base(farmId), method: "POST", body }),
      transformResponse: (r: ApiEnvelope<Delivery>) => r.data,
      invalidatesTags: [
        { type: "Delivery", id: "list" },
        { type: "Order", id: "list" },
        { type: "StockItem", id: "list" },
        { type: "InventoryAlert", id: "farm" },
      ],
    }),
    cancelDelivery: build.mutation<Delivery, { farmId: number; id: number; reason?: string }>({
      query: ({ farmId, id, reason }) => ({
        url: `${base(farmId)}/${id}/cancel`,
        method: "POST",
        body: { reason },
      }),
      transformResponse: (r: ApiEnvelope<Delivery>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Delivery", id },
        { type: "Delivery", id: "list" },
        { type: "Order", id: "list" },
        { type: "StockItem", id: "list" },
        { type: "InventoryAlert", id: "farm" },
      ],
    }),
  }),
});

export const {
  useGetDeliveriesQuery,
  useGetDeliveryQuery,
  useCreateDeliveryFromOrderMutation,
  useCancelDeliveryMutation,
} = deliveriesApi;
