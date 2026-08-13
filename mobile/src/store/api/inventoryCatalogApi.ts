/**
 * Inventory catalog — ported from `web/src/store/api/inventoryCatalogApi.ts`
 * (same backend). Mobile needs: the article library read (`getInventoryArticles`
 * = platform ∪ custom stockable articles) and the platform feed-formula
 * templates (`getPlatformFormulas`) used as clone sources. Custom articles are
 * created/removed through the generic catalog (`inventory_items`), like the web.
 * Gated `module.inventory` on the backend; catalog writes are OWNER/MANAGER.
 */
import { baseApi } from './baseApi';
import type { InventoryCatalogItem, PlatformFeedFormula } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/catalog`;

export const inventoryCatalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInventoryArticles: build.query<InventoryCatalogItem[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/articles`,
      transformResponse: (r: ApiEnvelope<InventoryCatalogItem[]>) => r.data,
      providesTags: [{ type: 'InventoryCatalog', id: 'articles' }],
    }),
    getPlatformFormulas: build.query<PlatformFeedFormula[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/feed-formulas`,
      transformResponse: (r: ApiEnvelope<PlatformFeedFormula[]>) => r.data,
      providesTags: [{ type: 'InventoryCatalog', id: 'platform-formulas' }],
    }),
    createArticle: build.mutation<
      void,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `/api/v1/farms/${farmId}/catalog/inventory_items`,
        method: 'POST',
        body: { key, value },
      }),
      invalidatesTags: [{ type: 'InventoryCatalog', id: 'articles' }],
    }),
    deleteArticle: build.mutation<void, { farmId: number; key: string }>({
      query: ({ farmId, key }) => ({
        url: `/api/v1/farms/${farmId}/catalog/inventory_items/${key}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'InventoryCatalog', id: 'articles' }],
    }),
  }),
});

export const {
  useGetInventoryArticlesQuery,
  useGetPlatformFormulasQuery,
  useCreateArticleMutation,
  useDeleteArticleMutation,
} = inventoryCatalogApi;
