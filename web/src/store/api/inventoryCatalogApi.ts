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
  }),
});

export const {
  useGetInventoryArticlesQuery,
  useGetAllArticlesQuery,
  useGetPlatformFormulasQuery,
} = inventoryCatalogApi;
