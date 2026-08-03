/**
 * Commercial deliveries — mirrors `web/src/store/api/deliveriesApi.ts`. Mobile
 * reads the deliveries list to let the user invoice a DELIVERED delivery that
 * isn't invoiced yet (the "Générer facture" flow). Creating a delivery from an
 * order ("Livrer") is a follow-up.
 */
import { baseApi } from './baseApi';
import type { Delivery, DeliveryFromOrderInput, DeliveryStatus } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/deliveries`;

export const deliveriesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDeliveries: build.query<Delivery[], { farmId: number; status?: DeliveryStatus }>({
      query: ({ farmId, status }) => (status ? `${base(farmId)}?status=${status}` : base(farmId)),
      transformResponse: (r: ApiEnvelope<Delivery[]>) => r.data,
      providesTags: [{ type: 'Delivery', id: 'list' }],
    }),
    createDeliveryFromOrder: build.mutation<Delivery, { farmId: number; body: DeliveryFromOrderInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Delivery>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: 'Delivery', id: 'list' },
        { type: 'Order', id: 'list' },
        { type: 'Order', id: body.orderId },
        { type: 'Dashboard', id: 'current' },
      ],
    }),
  }),
});

export const { useGetDeliveriesQuery, useCreateDeliveryFromOrderMutation } = deliveriesApi;
