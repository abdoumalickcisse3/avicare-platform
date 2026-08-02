/**
 * Commercial sales — mirrors `web/src/store/api/salesApi.ts` (same backend,
 * gated `module.commercial.basic` + WRITE_MANAGER). A "Vente directe" is a
 * single createSale; it decrements production stock (broiler lot count / egg
 * trays), so the production, client and dashboard caches are invalidated too.
 */
import { baseApi } from './baseApi';
import type { Sale, SaleInput } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/sales`;

export const salesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createSale: build.mutation<Sale, { farmId: number; body: SaleInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Sale>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [
        { type: 'Sale', id: 'list' },
        { type: 'Client', id: 'list' },
        { type: 'PoultryBatch', id: 'LIST' },
        { type: 'ProductionUnit', id: `LIST-${farmId}` },
        { type: 'TrayStock', id: 'CURRENT' },
        { type: 'Dashboard', id: 'current' },
      ],
    }),
  }),
});

export const { useCreateSaleMutation } = salesApi;
