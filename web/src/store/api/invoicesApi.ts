import { baseApi } from "./baseApi";
import type { Invoice, InvoiceStatus } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/invoices`;

const listTags = [
  { type: "Invoice" as const, id: "list" },
  { type: "Invoice" as const, id: "overdue" },
];

/**
 * Invoices (Sprint B5-6d): generated from a sale or a delivery. Issuing raises the
 * client receivable, so create/cancel invalidate the Client tags too (D26).
 */
export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInvoices: build.query<Invoice[], { farmId: number; status?: InvoiceStatus }>({
      query: ({ farmId, status }) => (status ? `${base(farmId)}?status=${status}` : base(farmId)),
      transformResponse: (r: ApiEnvelope<Invoice[]>) => r.data,
      providesTags: [{ type: "Invoice", id: "list" }],
    }),
    getOverdueInvoices: build.query<Invoice[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/overdue`,
      transformResponse: (r: ApiEnvelope<Invoice[]>) => r.data,
      providesTags: [{ type: "Invoice", id: "overdue" }],
    }),
    getInvoice: build.query<Invoice, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<Invoice>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: "Invoice", id }],
    }),
    createInvoiceFromSale: build.mutation<
      Invoice,
      { farmId: number; saleId: number; dueDate?: string }
    >({
      query: ({ farmId, saleId, dueDate }) => ({
        url: `${base(farmId)}/from-sale`,
        method: "POST",
        body: { saleId, dueDate },
      }),
      transformResponse: (r: ApiEnvelope<Invoice>) => r.data,
      invalidatesTags: [...listTags, { type: "Client", id: "list" }],
    }),
    createInvoiceFromDelivery: build.mutation<
      Invoice,
      { farmId: number; deliveryId: number; dueDate?: string }
    >({
      query: ({ farmId, deliveryId, dueDate }) => ({
        url: `${base(farmId)}/from-delivery`,
        method: "POST",
        body: { deliveryId, dueDate },
      }),
      transformResponse: (r: ApiEnvelope<Invoice>) => r.data,
      invalidatesTags: [...listTags, { type: "Client", id: "list" }],
    }),
    cancelInvoice: build.mutation<Invoice, { farmId: number; id: number; reason?: string }>({
      query: ({ farmId, id, reason }) => ({
        url: `${base(farmId)}/${id}/cancel`,
        method: "POST",
        body: { reason },
      }),
      transformResponse: (r: ApiEnvelope<Invoice>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Invoice", id },
        ...listTags,
        { type: "Client", id: "list" },
      ],
    }),
  }),
});

export const {
  useGetInvoicesQuery,
  useGetOverdueInvoicesQuery,
  useGetInvoiceQuery,
  useCreateInvoiceFromSaleMutation,
  useCreateInvoiceFromDeliveryMutation,
  useCancelInvoiceMutation,
} = invoicesApi;
