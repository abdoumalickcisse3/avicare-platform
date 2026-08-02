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
  }),
});

export const { useRecordPaymentMutation } = paymentsApi;
