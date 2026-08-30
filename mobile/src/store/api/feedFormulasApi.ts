/**
 * Feed formulas — ported from `web/src/store/api/feedFormulasApi.ts`. Mobile
 * reads the "available formulas" list (platform + farm) that feeds both the
 * daily-entry feed-source picker and the Formules screen, and supports the
 * lightweight write actions the field needs: clone a platform template,
 * recompute a formula's cost, and deactivate (delete) a farm formula. Composing
 * a formula from scratch (ingredient editor) stays on the web. Gated behind
 * `module.inventory` on the backend (403 when inactive).
 */
import { baseApi } from './baseApi';
import type { AvailableFeedFormulas, FarmFeedFormula, FeedFormulaInput } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

interface CloneFormulaInput {
  sourceFormulaKey: string;
  newName?: string;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/feed-formulas`;

export const feedFormulasApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAvailableFormulas: build.query<AvailableFeedFormulas, { farmId: number }>({
      query: ({ farmId }) => base(farmId),
      transformResponse: (r: ApiEnvelope<AvailableFeedFormulas>) => r.data,
      providesTags: [{ type: 'FeedFormula', id: 'available' }],
    }),
    cloneFeedFormula: build.mutation<FarmFeedFormula, { farmId: number; body: CloneFormulaInput }>({
      query: ({ farmId, body }) => ({ url: `${base(farmId)}/clone`, method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<FarmFeedFormula>) => r.data,
      invalidatesTags: [{ type: 'FeedFormula', id: 'available' }],
    }),
    recomputeFormulaCost: build.mutation<FarmFeedFormula, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/${id}/recompute-cost`, method: 'POST' }),
      transformResponse: (r: ApiEnvelope<FarmFeedFormula>) => r.data,
      invalidatesTags: [{ type: 'FeedFormula', id: 'available' }],
    }),
    deactivateFeedFormula: build.mutation<void, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/${id}/deactivate`, method: 'POST' }),
      invalidatesTags: [{ type: 'FeedFormula', id: 'available' }],
    }),
    /** One formula in full, ingredients included — the editor's starting point. */
    getFeedFormula: build.query<FarmFeedFormula, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<FarmFeedFormula>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: 'FeedFormula', id }],
    }),

    createFeedFormula: build.mutation<
      FarmFeedFormula,
      { farmId: number; body: FeedFormulaInput }
    >({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<FarmFeedFormula>) => r.data,
      invalidatesTags: [{ type: 'FeedFormula', id: 'LIST' }],
    }),

    updateFeedFormula: build.mutation<
      FarmFeedFormula,
      { farmId: number; id: number; body: FeedFormulaInput }
    >({
      query: ({ farmId, id, body }) => ({ url: `${base(farmId)}/${id}`, method: 'PUT', body }),
      transformResponse: (r: ApiEnvelope<FarmFeedFormula>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'FeedFormula', id },
        { type: 'FeedFormula', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetFeedFormulaQuery,
  useCreateFeedFormulaMutation,
  useUpdateFeedFormulaMutation,
  useGetAvailableFormulasQuery,
  useCloneFeedFormulaMutation,
  useRecomputeFormulaCostMutation,
  useDeactivateFeedFormulaMutation,
} = feedFormulasApi;
