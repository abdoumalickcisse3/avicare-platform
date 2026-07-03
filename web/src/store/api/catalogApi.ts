import { baseApi } from "./baseApi";

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
      providesTags: (_r, _e, { farmId, category }) => [{ type: "Catalog", id: `${farmId}-${category}` }],
    }),
    overrideCatalogEntry: build.mutation<
      CatalogEntry,
      { farmId: number; category: string; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, category, key, value }) => ({
        url: `/api/v1/farms/${farmId}/catalog/${category}`,
        method: "POST",
        body: { key, value },
      }),
      transformResponse: (r: ApiEnvelope<CatalogEntry>) => r.data,
      invalidatesTags: (_r, _e, { farmId, category }) => [{ type: "Catalog", id: `${farmId}-${category}` }],
    }),
    deleteCatalogEntry: build.mutation<void, { farmId: number; category: string; key: string }>({
      query: ({ farmId, category, key }) => ({
        url: `/api/v1/farms/${farmId}/catalog/${category}/${key}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { farmId, category }) => [{ type: "Catalog", id: `${farmId}-${category}` }],
    }),
  }),
});

export const {
  useGetCatalogQuery,
  useOverrideCatalogEntryMutation,
  useDeleteCatalogEntryMutation,
} = catalogApi;
