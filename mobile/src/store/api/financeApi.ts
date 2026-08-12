/**
 * Finance — ported from `web/src/store/api/financeApi.ts` (same backend). Mobile
 * keeps the field-relevant slice: expenses (list + create) and salaries (list +
 * pay). Analytics/advances/settings stay on the web for now. Gated
 * `module.finance`; writes are OWNER/MANAGER.
 */
import { baseApi } from './baseApi';
import type { Expense, ExpenseInput, Salary } from '@/types';

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
  }),
});

export const { useGetExpensesQuery, useCreateExpenseMutation, useGetSalariesQuery, usePaySalaryMutation } =
  financeApi;
