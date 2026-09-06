/**
 * Suppliers — ported from `web/src/store/api/suppliersApi.ts` (same
 * backend). Mobile keeps the list read plus create, used by the onboarding
 * inventory config step.
 */
import { baseApi } from './baseApi';

export interface Supplier {
  id: number;
  farmId?: number;
  commercialName: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  types?: string[];
  paymentTerms?: string | null;
  notes?: string | null;
  active?: boolean;
  /** Standing per-supplier switch: may a ledger payment notify this supplier by WhatsApp at all. */
  notifyWhatsapp: boolean;
}

/**
 * The backend PUT/POST replaces the whole resource (`SupplierService.apply`, full-replacement
 * semantics) — there is no PATCH. Every caller MUST resend every field the supplier already has,
 * not just the one it means to change: an omitted field is read as absent/false, not "leave
 * unchanged", so a caller that only sends `notifyWhatsapp` silently erases contactPerson, email,
 * address, city, types, paymentTerms and notes.
 */
export interface SupplierInput {
  commercialName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  types?: string[];
  paymentTerms?: string;
  notes?: string;
  /**
   * Required (not optional): the backend PUT/POST replaces the whole resource, and an omitted
   * boolean is read as `false`. Every caller must resend the supplier's current value.
   */
  notifyWhatsapp: boolean;
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
    getSupplier: build.query<Supplier, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<Supplier>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: 'Supplier', id }],
    }),

    updateSupplier: build.mutation<
      Supplier,
      { farmId: number; id: number; body: SupplierInput }
    >({
      query: ({ farmId, id, body }) => ({ url: `${base(farmId)}/${id}`, method: 'PUT', body }),
      transformResponse: (r: ApiEnvelope<Supplier>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Supplier', id },
        { type: 'Supplier', id: 'LIST' },
      ],
    }),

    deleteSupplier: build.mutation<void, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Supplier', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetSupplierQuery,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation, useGetSuppliersQuery, useCreateSupplierMutation } = suppliersApi;
