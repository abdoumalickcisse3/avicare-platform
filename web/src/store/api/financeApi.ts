import { baseApi } from "./baseApi";
import type { Expense, ExpenseInput, ExpenseSummary, UnitAnalytics } from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const financeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getExpenses: build.query<
      Expense[],
      { farmId: number; from?: string; to?: string; category?: string; unitId?: number }
    >({
      query: ({ farmId, from, to, category, unitId }) =>
        `/api/v1/farms/${farmId}/finance/expenses${toQueryString({ from, to, category, unitId })}`,
      transformResponse: (r: ApiEnvelope<Expense[]>) => r.data,
      providesTags: (_r, _e, { farmId }) => [{ type: "Expense", id: `LIST-${farmId}` }],
    }),
    createExpense: build.mutation<Expense, { farmId: number; body: ExpenseInput }>({
      query: ({ farmId, body }) => ({
        url: `/api/v1/farms/${farmId}/finance/expenses`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<Expense>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [{ type: "Expense", id: `LIST-${farmId}` }],
    }),
    updateExpense: build.mutation<Expense, { farmId: number; id: number; body: ExpenseInput }>({
      query: ({ farmId, id, body }) => ({
        url: `/api/v1/farms/${farmId}/finance/expenses/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (r: ApiEnvelope<Expense>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [{ type: "Expense", id: `LIST-${farmId}` }],
    }),
    deleteExpense: build.mutation<void, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({
        url: `/api/v1/farms/${farmId}/finance/expenses/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { farmId }) => [{ type: "Expense", id: `LIST-${farmId}` }],
    }),
    getExpenseSummary: build.query<ExpenseSummary, { farmId: number; from?: string; to?: string }>({
      query: ({ farmId, from, to }) =>
        `/api/v1/farms/${farmId}/finance/summary${toQueryString({ from, to })}`,
      transformResponse: (r: ApiEnvelope<ExpenseSummary>) => r.data,
      providesTags: (_r, _e, { farmId }) => [{ type: "Expense", id: `LIST-${farmId}` }],
    }),
    getUnitAnalytics: build.query<UnitAnalytics, { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => `/api/v1/farms/${farmId}/finance/units/${unitId}/analytics`,
      transformResponse: (r: ApiEnvelope<UnitAnalytics>) => r.data,
    }),
  }),
});

export const {
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useGetExpenseSummaryQuery,
  useGetUnitAnalyticsQuery,
} = financeApi;
