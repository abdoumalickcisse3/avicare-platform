import { baseApi } from "./baseApi";
import type { Sale, SaleInput, SaleStatus } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/sales`;

/**
 * Direct (cash) sales (Sprint B5-6b). Creating a sale decrements PRODUCT stock on
 * the backend (D21), so create/cancel invalidate the stock tags too. A sale also
 * touches the client receivable only through its invoice (B5-6d), not here.
 */
export const salesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSales: build.query<Sale[], { farmId: number; status?: SaleStatus }>({
      query: ({ farmId, status }) => (status ? `${base(farmId)}?status=${status}` : base(farmId)),
      transformResponse: (r: ApiEnvelope<Sale[]>) => r.data,
      providesTags: [{ type: "Sale", id: "list" }],
    }),
    getSale: build.query<Sale, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<Sale>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: "Sale", id }],
    }),
    createSale: build.mutation<Sale, { farmId: number; body: SaleInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: "POST", body }),
      transformResponse: (r: ApiEnvelope<Sale>) => r.data,
      invalidatesTags: [
        { type: "Sale", id: "list" },
        { type: "StockItem", id: "list" },
        { type: "InventoryAlert", id: "farm" },
      ],
    }),
    cancelSale: build.mutation<Sale, { farmId: number; id: number; reason?: string }>({
      query: ({ farmId, id, reason }) => ({
        url: `${base(farmId)}/${id}/cancel`,
        method: "POST",
        body: { reason },
      }),
      transformResponse: (r: ApiEnvelope<Sale>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Sale", id },
        { type: "Sale", id: "list" },
        { type: "StockItem", id: "list" },
        { type: "InventoryAlert", id: "farm" },
      ],
    }),
  }),
});

export const {
  useGetSalesQuery,
  useGetSaleQuery,
  useCreateSaleMutation,
  useCancelSaleMutation,
} = salesApi;
