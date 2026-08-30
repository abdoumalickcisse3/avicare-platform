/**
 * Commercial sales — mirrors `web/src/store/api/salesApi.ts` (same backend,
 * gated `module.commercial.basic` + WRITE_MANAGER). A "Vente directe" is a
 * single createSale; it decrements production stock (broiler lot count / egg
 * trays), so the production, client and dashboard caches are invalidated too.
 */
import { baseApi } from './baseApi';
import type { Sale, SaleInput, SaleStatus } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/sales`;

// A sale touches production stock; a create or a cancel (which reverses stock)
// invalidates the same production + client + dashboard caches.
const saleStockTags = (farmId: number) =>
  [
    { type: 'Sale', id: 'list' },
    { type: 'Client', id: 'list' },
    { type: 'PoultryBatch', id: 'LIST' },
    { type: 'ProductionUnit', id: `LIST-${farmId}` },
    { type: 'TrayStock', id: 'CURRENT' },
    { type: 'Dashboard', id: 'current' },
  ] as const;

export const salesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSales: build.query<Sale[], { farmId: number; status?: SaleStatus }>({
      query: ({ farmId, status }) => (status ? `${base(farmId)}?status=${status}` : base(farmId)),
      transformResponse: (r: ApiEnvelope<Sale[]>) => r.data,
      providesTags: [{ type: 'Sale', id: 'list' }],
    }),
    createSale: build.mutation<Sale, { farmId: number; body: SaleInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Sale>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [...saleStockTags(farmId)],
    }),
    cancelSale: build.mutation<Sale, { farmId: number; id: number; reason?: string }>({
      query: ({ farmId, id, reason }) => ({
        url: `${base(farmId)}/${id}/cancel`,
        method: 'POST',
        body: { reason },
      }),
      transformResponse: (r: ApiEnvelope<Sale>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [...saleStockTags(farmId)],
    }),
    getSale: build.query<Sale, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<Sale>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: 'Sale', id }],
    }),
  }),
});

export const {
  useGetSaleQuery, useGetSalesQuery, useCreateSaleMutation, useCancelSaleMutation } = salesApi;
