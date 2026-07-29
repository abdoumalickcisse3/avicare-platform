/**
 * Farm catalog — ported from `web/src/store/api/catalogApi.ts` (same
 * backend). Onboarding config steps read/override/delete per-category catalog
 * entries (e.g. breeds, expense categories) for a farm.
 */
import { baseApi } from './baseApi';

export interface CatalogEntry {
  category: string;
  key: string;
  value: Record<string, unknown>;
  custom: boolean;
}

interface ApiEnvelope<T> {
  data: T;
}

export const catalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCatalog: build.query<CatalogEntry[], { farmId: number; category: string }>({
      query: ({ farmId, category }) => `/api/v1/farms/${farmId}/catalog/${category}`,
      transformResponse: (r: ApiEnvelope<CatalogEntry[]>) => r.data,
      providesTags: (_r, _e, { farmId, category }) => [
        { type: 'Catalog', id: `${farmId}-${category}` },
      ],
    }),
    overrideCatalogEntry: build.mutation<
      void,
      { farmId: number; category: string; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, category, key, value }) => ({
        url: `/api/v1/farms/${farmId}/catalog/${category}`,
        method: 'POST',
        body: { key, value },
      }),
      invalidatesTags: (_r, _e, { farmId, category }) => [
        { type: 'Catalog', id: `${farmId}-${category}` },
      ],
    }),
    deleteCatalogEntry: build.mutation<void, { farmId: number; category: string; key: string }>({
      query: ({ farmId, category, key }) => ({
        url: `/api/v1/farms/${farmId}/catalog/${category}/${key}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { farmId, category }) => [
        { type: 'Catalog', id: `${farmId}-${category}` },
      ],
    }),
  }),
});

export const { useGetCatalogQuery, useOverrideCatalogEntryMutation, useDeleteCatalogEntryMutation } =
  catalogApi;
