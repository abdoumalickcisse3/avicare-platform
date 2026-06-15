import { baseApi } from "./baseApi";
import type { Supplier, SupplierInput } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/suppliers`;

/** Per-farm supplier directory CRUD (Sprint B4). Soft-delete via DELETE. */
export const suppliersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSuppliers: build.query<Supplier[], { farmId: number }>({
      query: ({ farmId }) => base(farmId),
      transformResponse: (r: ApiEnvelope<Supplier[]>) => r.data,
      providesTags: [{ type: "Supplier", id: "list" }],
    }),
    getSupplier: build.query<Supplier, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<Supplier>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: "Supplier", id }],
    }),
    createSupplier: build.mutation<
      Supplier,
      { farmId: number; body: SupplierInput }
    >({
      query: ({ farmId, body }) => ({ url: base(farmId), method: "POST", body }),
      transformResponse: (r: ApiEnvelope<Supplier>) => r.data,
      invalidatesTags: [{ type: "Supplier", id: "list" }],
    }),
    updateSupplier: build.mutation<
      Supplier,
      { farmId: number; id: number; body: SupplierInput }
    >({
      query: ({ farmId, id, body }) => ({
        url: `${base(farmId)}/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (r: ApiEnvelope<Supplier>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Supplier", id },
        { type: "Supplier", id: "list" },
      ],
    }),
    deleteSupplier: build.mutation<void, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Supplier", id: "list" }],
    }),
  }),
});

export const {
  useGetSuppliersQuery,
  useGetSupplierQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
} = suppliersApi;
