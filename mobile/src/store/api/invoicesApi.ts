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
  }),
});

export const { useGetInvoicesQuery, useCreateInvoiceFromSaleMutation } = invoicesApi;
