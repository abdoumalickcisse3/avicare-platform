/**
 * Commercial payments — mirrors `web/src/store/api/paymentsApi.ts` (same
 * backend, WRITE_MANAGER). Recording a payment against an invoice updates the
 * invoice status and the client receivable (encours, D26), so those caches are
 * invalidated.
 */
import { baseApi } from './baseApi';
import type { Payment, PaymentInput } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/payments`;

export const paymentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    recordPayment: build.mutation<Payment, { farmId: number; body: PaymentInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Payment>) => r.data,
      invalidatesTags: [
        { type: 'Payment', id: 'list' },
        { type: 'Invoice', id: 'list' },
        { type: 'Client', id: 'list' },
        { type: 'Dashboard', id: 'current' },
      ],
    }),
    getPayments: build.query<Payment[], { farmId: number; invoiceId?: number }>({
      query: ({ farmId, invoiceId }) =>
        invoiceId != null ? `${base(farmId)}?invoiceId=${invoiceId}` : base(farmId),
      transformResponse: (r: ApiEnvelope<Payment[]>) => r.data,
      providesTags: [{ type: 'Payment', id: 'LIST' }],
    }),

    /**
     * Voiding a payment puts the amount back on the invoice and on the client's balance, so it
     * invalidates both. It is not a delete: the voided row stays visible in the history.
     */
    voidPayment: build.mutation<Payment, { farmId: number; id: number; reason?: string }>({
      query: ({ farmId, id, reason }) => ({
        url: `${base(farmId)}/${id}/void`,
        method: 'POST',
        body: reason ? { reason } : undefined,
      }),
      transformResponse: (r: ApiEnvelope<Payment>) => r.data,
      invalidatesTags: [
        { type: 'Payment', id: 'LIST' },
        { type: 'Invoice', id: 'LIST' },
        { type: 'Client', id: 'list' },
      ],
    }),
  }),
});

export const {
  useGetPaymentsQuery,
  useVoidPaymentMutation, useRecordPaymentMutation } = paymentsApi;
