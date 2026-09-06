/**
 * The supplier current account — ported from `web/src/store/api/supplierLedgerApi.ts` (same
 * backend, same URLs: `web/src/store/api/parity.test.ts` compares them character for character).
 *
 * A ledger entry never creates a server-side expense: that charge is recorded at purchase-order
 * receipt. But it moves cash, so the dashboard and balances are invalidated alongside it.
 */
import { baseApi } from './baseApi';
import type { SupplierBalance, SupplierStatement } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/suppliers`;

interface LedgerEntryBody {
  amountXof: number;
  entryDate: string;
  label?: string;
  method?: string;
  reference?: string;
  /**
   * Absent is read as true server-side (`Object.notify()` is final, so the DTO can't be called
   * `notify`). A payment must always send it explicitly.
   */
  notifySupplier?: boolean;
}

export const supplierLedgerApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSupplierBalances: build.query<SupplierBalance[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/balances`,
      transformResponse: (r: ApiEnvelope<SupplierBalance[]>) => r.data,
      providesTags: [{ type: 'Supplier', id: 'balances' }],
    }),
    getSupplierLedger: build.query<SupplierStatement, { farmId: number; supplierId: number }>({
      query: ({ farmId, supplierId }) => `${base(farmId)}/${supplierId}/ledger`,
      transformResponse: (r: ApiEnvelope<SupplierStatement>) => r.data,
      providesTags: (_r, _e, { supplierId }) => [{ type: 'Supplier', id: `ledger-${supplierId}` }],
    }),
    recordSupplierPayment: build.mutation<
      number,
      { farmId: number; supplierId: number; body: LedgerEntryBody }
    >({
      query: ({ farmId, supplierId, body }) => ({
        url: `${base(farmId)}/${supplierId}/ledger/payments`,
        method: 'POST',
        body,
      }),
      transformResponse: (r: ApiEnvelope<number>) => r.data,
      invalidatesTags: (_r, _e, { supplierId }) => [
        { type: 'Supplier', id: `ledger-${supplierId}` },
        { type: 'Supplier', id: 'balances' },
      ],
    }),
    recordSupplierCharge: build.mutation<
      number,
      { farmId: number; supplierId: number; body: LedgerEntryBody }
    >({
      query: ({ farmId, supplierId, body }) => ({
        url: `${base(farmId)}/${supplierId}/ledger/charges`,
        method: 'POST',
        body,
      }),
      transformResponse: (r: ApiEnvelope<number>) => r.data,
      invalidatesTags: (_r, _e, { supplierId }) => [
        { type: 'Supplier', id: `ledger-${supplierId}` },
        { type: 'Supplier', id: 'balances' },
      ],
    }),
    deleteLedgerEntry: build.mutation<void, { farmId: number; supplierId: number; entryId: number }>({
      query: ({ farmId, supplierId, entryId }) => ({
        url: `${base(farmId)}/${supplierId}/ledger/entries/${entryId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { supplierId }) => [
        { type: 'Supplier', id: `ledger-${supplierId}` },
        { type: 'Supplier', id: 'balances' },
      ],
    }),
  }),
});

export const {
  useGetSupplierBalancesQuery,
  useGetSupplierLedgerQuery,
  useRecordSupplierPaymentMutation,
  useRecordSupplierChargeMutation,
  useDeleteLedgerEntryMutation,
} = supplierLedgerApi;
