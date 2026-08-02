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
  }),
});

export const { useGetInvoicesQuery } = invoicesApi;
