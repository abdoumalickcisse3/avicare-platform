/**
 * Feed formulas — ported from `web/src/store/api/feedFormulasApi.ts`. Mobile
 * only needs the "available formulas" read (platform + farm) that feeds the
 * daily-entry feed-source picker. Gated behind `module.inventory` on the
 * backend (403 when inactive).
 */
import { baseApi } from './baseApi';
import type { AvailableFeedFormulas } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/feed-formulas`;

export const feedFormulasApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAvailableFormulas: build.query<AvailableFeedFormulas, { farmId: number }>({
      query: ({ farmId }) => base(farmId),
      transformResponse: (r: ApiEnvelope<AvailableFeedFormulas>) => r.data,
      providesTags: [{ type: 'FeedFormula', id: 'available' }],
    }),
  }),
});

export const { useGetAvailableFormulasQuery } = feedFormulasApi;
