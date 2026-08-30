/**
 * Finance — ported from `web/src/store/api/financeApi.ts` (same backend). Mobile
 * keeps the field-relevant slice: expenses (list + create) and salaries (list +
 * pay). Analytics/advances/settings stay on the web for now. Gated
 * `module.finance`; writes are OWNER/MANAGER.
 */
import { baseApi } from './baseApi';
import type {
  Advance,
  AdvanceInput,
  AdvanceStatus,
  Expense,
  ExpenseInput,
  ExpenseSummary,
  FarmAnalytics,
  Salary,
  SalarySetting,
  SalarySettingInput,
} from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/finance`;

export const financeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getExpenses: build.query<Expense[], { farmId: number; from?: string; to?: string }>({
      query: ({ farmId, from, to }) => {
        const qs = new URLSearchParams();
        if (from) qs.set('from', from);
        if (to) qs.set('to', to);
        const s = qs.toString();
        return s ? `${base(farmId)}/expenses?${s}` : `${base(farmId)}/expenses`;
      },
      transformResponse: (r: ApiEnvelope<Expense[]>) => r.data,
      providesTags: [{ type: 'Expense', id: 'list' }],
    }),
    createExpense: build.mutation<Expense, { farmId: number; body: ExpenseInput }>({
      query: ({ farmId, body }) => ({ url: `${base(farmId)}/expenses`, method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Expense>) => r.data,
      invalidatesTags: [
        { type: 'Expense', id: 'list' },
        { type: 'Dashboard', id: 'current' },
      ],
    }),
    getFarmAnalytics: build.query<FarmAnalytics, { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/analytics`,
      transformResponse: (r: ApiEnvelope<FarmAnalytics>) => r.data,
      providesTags: [
        { type: 'Expense', id: 'list' },
        { type: 'Sale', id: 'list' },
      ],
    }),
    getSalaries: build.query<Salary[], { farmId: number; period?: string }>({
      query: ({ farmId, period }) => (period ? `${base(farmId)}/salaries?period=${period}` : `${base(farmId)}/salaries`),
      transformResponse: (r: ApiEnvelope<Salary[]>) => r.data,
      providesTags: [{ type: 'Salary', id: 'list' }],
    }),
    paySalary: build.mutation<Salary, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/salaries/${id}/pay`, method: 'POST' }),
      transformResponse: (r: ApiEnvelope<Salary>) => r.data,
      invalidatesTags: [
        { type: 'Salary', id: 'list' },
        { type: 'Expense', id: 'list' },
        { type: 'Dashboard', id: 'current' },
      ],
    }),
    updateExpense: build.mutation<Expense, { farmId: number; id: number; body: ExpenseInput }>({
      query: ({ farmId, id, body }) => ({
        url: `/api/v1/farms/${farmId}/finance/expenses/${id}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (r: ApiEnvelope<Expense>) => r.data,
      invalidatesTags: [
        { type: 'Expense', id: 'LIST' },
        { type: 'Expense', id: 'ANALYTICS' },
      ],
    }),

    deleteExpense: build.mutation<void, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({
        url: `/api/v1/farms/${farmId}/finance/expenses/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'Expense', id: 'LIST' },
        { type: 'Expense', id: 'ANALYTICS' },
      ],
    }),

    getExpenseSummary: build.query<ExpenseSummary, { farmId: number; from?: string; to?: string }>({
      query: ({ farmId, from, to }) => {
        const qs = [from ? `from=${from}` : '', to ? `to=${to}` : ''].filter(Boolean).join('&');
        return `/api/v1/farms/${farmId}/finance/expenses/summary${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (r: ApiEnvelope<ExpenseSummary>) => r.data,
      providesTags: [{ type: 'Expense', id: 'SUMMARY' }],
    }),

    getSalarySettings: build.query<SalarySetting[], { farmId: number }>({
      query: ({ farmId }) => `/api/v1/farms/${farmId}/finance/salary-settings`,
      transformResponse: (r: ApiEnvelope<SalarySetting[]>) => r.data,
      providesTags: [{ type: 'Salary', id: 'SETTINGS' }],
    }),

    /** Create and update are the same call — the backend upserts on the member. */
    upsertSalarySetting: build.mutation<
      SalarySetting,
      { farmId: number; body: SalarySettingInput }
    >({
      query: ({ farmId, body }) => ({
        url: `/api/v1/farms/${farmId}/finance/salary-settings`,
        method: 'POST',
        body,
      }),
      transformResponse: (r: ApiEnvelope<SalarySetting>) => r.data,
      invalidatesTags: [{ type: 'Salary', id: 'SETTINGS' }],
    }),

    /**
     * Generates every active member's line for one `YYYY-MM` period, in one shot.
     *
     * All-or-nothing: if a single member already has a line for that period the backend answers
     * 409 SALARY_PERIOD_EXISTS and generates nothing at all — so this cannot be used to top up a
     * period after hiring someone mid-month.
     */
    generateSalaries: build.mutation<Salary[], { farmId: number; period: string }>({
      query: ({ farmId, period }) => ({
        url: `/api/v1/farms/${farmId}/finance/salaries/generate`,
        method: 'POST',
        body: { period },
      }),
      transformResponse: (r: ApiEnvelope<Salary[]>) => r.data,
      invalidatesTags: [
        { type: 'Salary', id: 'LIST' },
        { type: 'Expense', id: 'LIST' },
      ],
    }),

    getAdvances: build.query<Advance[], { farmId: number; status?: AdvanceStatus }>({
      query: ({ farmId, status }) =>
        `/api/v1/farms/${farmId}/finance/advances${status ? `?status=${status}` : ''}`,
      transformResponse: (r: ApiEnvelope<Advance[]>) => r.data,
      providesTags: [{ type: 'Salary', id: 'ADVANCES' }],
    }),

    /** Approving books a `staff` expense immediately — hence the Expense invalidation. */
    approveAdvance: build.mutation<Advance, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({
        url: `/api/v1/farms/${farmId}/finance/advances/${id}/approve`,
        method: 'POST',
      }),
      transformResponse: (r: ApiEnvelope<Advance>) => r.data,
      invalidatesTags: [
        { type: 'Salary', id: 'ADVANCES' },
        { type: 'Expense', id: 'LIST' },
        { type: 'Expense', id: 'ANALYTICS' },
      ],
    }),

    /** Rejecting books nothing — it only closes the request. */
    rejectAdvance: build.mutation<Advance, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({
        url: `/api/v1/farms/${farmId}/finance/advances/${id}/reject`,
        method: 'POST',
      }),
      transformResponse: (r: ApiEnvelope<Advance>) => r.data,
      invalidatesTags: [{ type: 'Salary', id: 'ADVANCES' }],
    }),

    /** The self-service side: not farm-scoped in the path, the farm is a query parameter. */
    getMyAdvances: build.query<Advance[], { farmId: number }>({
      query: ({ farmId }) => `/api/v1/my/advances?farmId=${farmId}`,
      transformResponse: (r: ApiEnvelope<Advance[]>) => r.data,
      providesTags: [{ type: 'Salary', id: 'MY-ADVANCES' }],
    }),

    requestAdvance: build.mutation<Advance, { body: AdvanceInput }>({
      query: ({ body }) => ({ url: '/api/v1/my/advances', method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Advance>) => r.data,
      invalidatesTags: [
        { type: 'Salary', id: 'MY-ADVANCES' },
        { type: 'Salary', id: 'ADVANCES' },
      ],
    }),
  }),
});

export const {
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useGetExpenseSummaryQuery,
  useGetSalarySettingsQuery,
  useUpsertSalarySettingMutation,
  useGenerateSalariesMutation,
  useGetAdvancesQuery,
  useApproveAdvanceMutation,
  useRejectAdvanceMutation,
  useGetMyAdvancesQuery,
  useRequestAdvanceMutation,
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useGetFarmAnalyticsQuery,
  useGetSalariesQuery,
  usePaySalaryMutation,
} = financeApi;
