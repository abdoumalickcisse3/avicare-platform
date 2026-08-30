/**
 * Commercial invoices — mirrors the web (same backend, gated
 * `module.commercial.basic`). Mobile reads a client's invoices to collect a
 * payment against the outstanding balance (`outstandingXof`).
 */
import { baseApi } from './baseApi';
import type { Invoice } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/invoices`;

export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInvoices: build.query<Invoice[], { farmId: number; clientId?: number }>({
      query: ({ farmId, clientId }) =>
        clientId != null ? `${base(farmId)}?clientId=${clientId}` : base(farmId),
      transformResponse: (r: ApiEnvelope<Invoice[]>) => r.data,
      providesTags: [{ type: 'Invoice', id: 'list' }],
    }),
    getInvoice: build.query<Invoice, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<Invoice>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: 'Invoice', id }],
    }),
    createInvoiceFromSale: build.mutation<Invoice, { farmId: number; saleId: number; dueDate?: string }>({
      query: ({ farmId, saleId, dueDate }) => ({
        url: `${base(farmId)}/from-sale`,
        method: 'POST',
        body: { saleId, dueDate },
      }),
      transformResponse: (r: ApiEnvelope<Invoice>) => r.data,
      invalidatesTags: [
        { type: 'Invoice', id: 'list' },
        { type: 'Client', id: 'list' },
        { type: 'Dashboard', id: 'current' },
      ],
    }),
    createInvoiceFromDelivery: build.mutation<Invoice, { farmId: number; deliveryId: number; dueDate?: string }>({
      query: ({ farmId, deliveryId, dueDate }) => ({
        url: `${base(farmId)}/from-delivery`,
        method: 'POST',
        body: { deliveryId, dueDate },
      }),
      transformResponse: (r: ApiEnvelope<Invoice>) => r.data,
      invalidatesTags: [
        { type: 'Invoice', id: 'list' },
        { type: 'Delivery', id: 'list' },
        { type: 'Client', id: 'list' },
        { type: 'Dashboard', id: 'current' },
      ],
    }),
    getOverdueInvoices: build.query<Invoice[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/overdue`,
      transformResponse: (r: ApiEnvelope<Invoice[]>) => r.data,
      providesTags: [{ type: 'Invoice', id: 'OVERDUE' }],
    }),

    /** Cancelling an invoice clears what it claimed from the client's running account. */
    cancelInvoice: build.mutation<Invoice, { farmId: number; id: number; reason?: string }>({
      query: ({ farmId, id, reason }) => ({
        url: `${base(farmId)}/${id}/cancel`,
        method: 'POST',
        body: reason ? { reason } : undefined,
      }),
      transformResponse: (r: ApiEnvelope<Invoice>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Invoice', id },
        { type: 'Invoice', id: 'LIST' },
        { type: 'Invoice', id: 'OVERDUE' },
        { type: 'Client', id: 'list' },
      ],
    }),
  }),
});

export const {
  useGetOverdueInvoicesQuery,
  useCancelInvoiceMutation,
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useCreateInvoiceFromSaleMutation,
  useCreateInvoiceFromDeliveryMutation,
} = invoicesApi;
