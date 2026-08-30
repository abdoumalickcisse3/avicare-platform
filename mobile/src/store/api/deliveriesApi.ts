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
    getDelivery: build.query<Delivery, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<Delivery>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: 'Delivery', id }],
    }),

    /**
     * Cancelling a delivery releases the stock it had reserved, so it invalidates the flock and
     * tray counts too — the D27 coupling runs in reverse.
     */
    cancelDelivery: build.mutation<Delivery, { farmId: number; id: number; reason?: string }>({
      query: ({ farmId, id, reason }) => ({
        url: `${base(farmId)}/${id}/cancel`,
        method: 'POST',
        body: reason ? { reason } : undefined,
      }),
      transformResponse: (r: ApiEnvelope<Delivery>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Delivery', id },
        { type: 'Delivery', id: 'LIST' },
        { type: 'Order', id: 'LIST' },
        { type: 'PoultryBatch', id: 'LIST' },
        { type: 'TrayStock', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetDeliveryQuery,
  useCancelDeliveryMutation, useGetDeliveriesQuery, useCreateDeliveryFromOrderMutation } = deliveriesApi;
