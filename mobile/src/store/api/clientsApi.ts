/**
 * Commercial clients — ported from `web/src/store/api/clientsApi.ts` (same
 * backend). Mobile keeps the read the Commerce directory needs: the per-farm
 * client list (each client is a running account — `currentBalanceXof`). CRUD /
 * credit endpoints stay on the web for now.
 *
 * Gated behind `module.commercial` on the backend (403 when inactive).
 */
import { baseApi } from './baseApi';
import type { Client } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/clients`;

export const clientsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getClients: build.query<Client[], { farmId: number }>({
      query: ({ farmId }) => base(farmId),
      transformResponse: (r: ApiEnvelope<Client[]>) => r.data,
      providesTags: [{ type: 'Client', id: 'list' }],
    }),
  }),
});

export const { useGetClientsQuery } = clientsApi;
