/**
 * Suppliers — ported from `web/src/store/api/suppliersApi.ts` (same
 * backend). Mobile keeps the list read plus create, used by the onboarding
 * inventory config step.
 */
import { baseApi } from './baseApi';

export interface Supplier {
  id: number;
  commercialName: string;
  phone?: string | null;
}

export interface SupplierInput {
  commercialName: string;
  phone?: string;
}

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/suppliers`;

export const suppliersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSuppliers: build.query<Supplier[], { farmId: number }>({
      query: ({ farmId }) => base(farmId),
      transformResponse: (r: ApiEnvelope<Supplier[]>) => r.data,
      providesTags: [{ type: 'Supplier', id: 'LIST' }],
    }),
    createSupplier: build.mutation<Supplier, { farmId: number; body: SupplierInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Supplier>) => r.data,
      invalidatesTags: [{ type: 'Supplier', id: 'LIST' }],
    }),
  }),
});

export const { useGetSuppliersQuery, useCreateSupplierMutation } = suppliersApi;
