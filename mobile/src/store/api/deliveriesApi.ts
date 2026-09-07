/**
 * Commercial deliveries — mirrors `web/src/store/api/deliveriesApi.ts`. Mobile
 * reads the deliveries list to let the user invoice a DELIVERED delivery that
 * isn't invoiced yet (the "Générer facture" flow), creates one from an order
 * ("Livrer"), and cancels one from the order it came from.
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
     * Cancelling a delivery reopens the order and puts the stock back (D21/D27 run in reverse:
     * a compensating IN movement, or a restock on the production unit), so the flock and tray
     * counts move too.
     *
     * The tag ids below are the ones the queries actually provide — `Delivery`/`Order` publish
     * `list` lowercase, tray stock publishes `CURRENT`. This mutation shipped with `LIST` on all
     * three while it was reachable from nowhere, so nothing ever revealed that a cancellation
     * refreshed none of them.
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
        { type: 'Delivery', id: 'list' },
        { type: 'Order', id: 'list' },
        { type: 'PoultryBatch', id: 'LIST' },
        { type: 'TrayStock', id: 'CURRENT' },
        { type: 'Dashboard', id: 'current' },
      ],
    }),
  }),
});

export const {
  useGetDeliveryQuery,
  useCancelDeliveryMutation, useGetDeliveriesQuery, useCreateDeliveryFromOrderMutation } = deliveriesApi;
