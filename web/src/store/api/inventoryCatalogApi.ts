import { baseApi } from "./baseApi";
import type { InventoryCatalogItem, PlatformFormula } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/catalog`;

/**
 * Inventory catalog (Sprint B4, read-only) — platform articles, the unified
 * stockable articles (inventory items ∪ medications) used by movement/PO/coupling
 * pickers, and the platform feed-formula templates used as clone sources.
 */
export const inventoryCatalogApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInventoryArticles: build.query<InventoryCatalogItem[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/articles`,
      transformResponse: (r: ApiEnvelope<InventoryCatalogItem[]>) => r.data,
      providesTags: [{ type: "InventoryCatalog", id: "articles" }],
    }),
    getAllArticles: build.query<InventoryCatalogItem[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/articles/all`,
      transformResponse: (r: ApiEnvelope<InventoryCatalogItem[]>) => r.data,
      providesTags: [{ type: "InventoryCatalog", id: "all" }],
    }),
    getPlatformFormulas: build.query<PlatformFormula[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/feed-formulas`,
      transformResponse: (r: ApiEnvelope<PlatformFormula[]>) => r.data,
      providesTags: [{ type: "InventoryCatalog", id: "platform-formulas" }],
    }),

    /**
     * One platform template, with its composition and a cost recomputed from today's catalog
     * prices. The list carries the same shape, but the clone dialog only ever needs the one being
     * considered — and asking for it is what lets the farmer see what they are about to adopt
     * instead of choosing a formula by its name alone.
     */
    getPlatformFormula: build.query<PlatformFormula, { farmId: number; key: string }>({
      query: ({ farmId, key }) =>
        `/api/v1/farms/${farmId}/inventory/catalog/feed-formulas/${encodeURIComponent(key)}`,
      transformResponse: (r: ApiEnvelope<PlatformFormula>) => r.data,
      providesTags: [{ type: "InventoryCatalog", id: "platform-formulas" }],
    }),
    createArticle: build.mutation<
      void,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `/api/v1/farms/${farmId}/catalog/inventory_items`,
        method: "POST",
        body: { key, value },
      }),
      invalidatesTags: [
        { type: "InventoryCatalog", id: "articles" },
        { type: "InventoryCatalog", id: "all" },
        { type: "InventoryCatalog", id: "platform-formulas" },
      ],
    }),
    updateArticle: build.mutation<
      void,
      { farmId: number; key: string; value: Record<string, unknown> }
    >({
      query: ({ farmId, key, value }) => ({
        url: `/api/v1/farms/${farmId}/catalog/inventory_items`,
        method: "POST",
        body: { key, value },
      }),
      invalidatesTags: [
        { type: "InventoryCatalog", id: "articles" },
        { type: "InventoryCatalog", id: "all" },
        { type: "InventoryCatalog", id: "platform-formulas" },
      ],
    }),
    deleteArticle: build.mutation<void, { farmId: number; key: string }>({
      query: ({ farmId, key }) => ({
        url: `/api/v1/farms/${farmId}/catalog/inventory_items/${key}`,
        method: "DELETE",
      }),
      invalidatesTags: [
        { type: "InventoryCatalog", id: "articles" },
        { type: "InventoryCatalog", id: "all" },
        { type: "InventoryCatalog", id: "platform-formulas" },
      ],
    }),
  }),
});

export const {
  useGetInventoryArticlesQuery,
  useGetAllArticlesQuery,
  useGetPlatformFormulasQuery,
  useGetPlatformFormulaQuery,
  useCreateArticleMutation,
  useUpdateArticleMutation,
  useDeleteArticleMutation,
} = inventoryCatalogApi;
