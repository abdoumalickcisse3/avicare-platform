import { baseApi } from "./baseApi";
import type { Payment, PaymentInput } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/payments`;

/**
 * Payments against invoices (Sprint B5-6d). Recording/voiding a payment moves the
 * invoice status and the client receivable on the backend (D26), so mutations
 * invalidate the Invoice and Client tags.
 */
export const paymentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPayments: build.query<Payment[], { farmId: number; invoiceId?: number }>({
      query: ({ farmId, invoiceId }) =>
        invoiceId != null ? `${base(farmId)}?invoiceId=${invoiceId}` : base(farmId),
      transformResponse: (r: ApiEnvelope<Payment[]>) => r.data,
      providesTags: [{ type: "Payment", id: "list" }],
    }),
    recordPayment: build.mutation<Payment, { farmId: number; body: PaymentInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: "POST", body }),
      transformResponse: (r: ApiEnvelope<Payment>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: "Payment", id: "list" },
        { type: "Invoice", id: body.invoiceId },
        { type: "Invoice", id: "list" },
        { type: "Invoice", id: "overdue" },
        { type: "Client", id: "list" },
      ],
    }),
    voidPayment: build.mutation<Payment, { farmId: number; id: number; reason?: string }>({
      query: ({ farmId, id, reason }) => ({
        url: `${base(farmId)}/${id}/void`,
        method: "POST",
        body: { reason },
      }),
      transformResponse: (r: ApiEnvelope<Payment>) => r.data,
      invalidatesTags: [
        { type: "Payment", id: "list" },
        { type: "Invoice", id: "list" },
        { type: "Invoice", id: "overdue" },
        { type: "Client", id: "list" },
      ],
    }),
  }),
});

export const {
  useGetPaymentsQuery,
  useRecordPaymentMutation,
  useVoidPaymentMutation,
} = paymentsApi;
