import { baseApi } from "./baseApi";
import type {
  Advance,
  AdvanceInput,
  AdvanceStatus,
  Expense,
  ExpenseInput,
  ExpenseSummary,
  Salary,
  SalarySetting,
  UnitAnalytics,
} from "@/types";

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
    getSalarySettings: build.query<SalarySetting[], { farmId: number }>({
      query: ({ farmId }) => `/api/v1/farms/${farmId}/finance/salary-settings`,
      transformResponse: (r: ApiEnvelope<SalarySetting[]>) => r.data,
      providesTags: (_r, _e, { farmId }) => [{ type: "Salary", id: `SETTINGS-${farmId}` }],
    }),
    upsertSalarySetting: build.mutation<
      SalarySetting,
      { farmId: number; body: { userId: number; monthlySalaryXof: number; active?: boolean } }
    >({
      query: ({ farmId, body }) => ({
        url: `/api/v1/farms/${farmId}/finance/salary-settings`,
        method: "PUT",
        body,
      }),
      transformResponse: (r: ApiEnvelope<SalarySetting>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [{ type: "Salary", id: `SETTINGS-${farmId}` }],
    }),
    getSalaries: build.query<Salary[], { farmId: number; period?: string }>({
      query: ({ farmId, period }) =>
        `/api/v1/farms/${farmId}/finance/salaries${toQueryString({ period })}`,
      transformResponse: (r: ApiEnvelope<Salary[]>) => r.data,
      providesTags: (_r, _e, { farmId }) => [{ type: "Salary", id: `LIST-${farmId}` }],
    }),
    generateSalaries: build.mutation<Salary[], { farmId: number; period: string }>({
      query: ({ farmId, period }) => ({
        url: `/api/v1/farms/${farmId}/finance/salaries/generate`,
        method: "POST",
        body: { period },
      }),
      transformResponse: (r: ApiEnvelope<Salary[]>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [{ type: "Salary", id: `LIST-${farmId}` }],
    }),
    paySalary: build.mutation<Salary, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({
        url: `/api/v1/farms/${farmId}/finance/salaries/${id}/pay`,
        method: "POST",
      }),
      transformResponse: (r: ApiEnvelope<Salary>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [
        { type: "Salary", id: `LIST-${farmId}` },
        { type: "Expense", id: `LIST-${farmId}` },
      ],
    }),
    getAdvances: build.query<Advance[], { farmId: number; status?: AdvanceStatus }>({
      query: ({ farmId, status }) =>
        `/api/v1/farms/${farmId}/finance/advances${toQueryString({ status })}`,
      transformResponse: (r: ApiEnvelope<Advance[]>) => r.data,
      providesTags: (_r, _e, { farmId }) => [{ type: "Advance", id: `LIST-${farmId}` }],
    }),
    approveAdvance: build.mutation<Advance, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({
        url: `/api/v1/farms/${farmId}/finance/advances/${id}/approve`,
        method: "POST",
      }),
      transformResponse: (r: ApiEnvelope<Advance>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [
        { type: "Advance", id: `LIST-${farmId}` },
        { type: "Expense", id: `LIST-${farmId}` },
      ],
    }),
    rejectAdvance: build.mutation<Advance, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({
        url: `/api/v1/farms/${farmId}/finance/advances/${id}/reject`,
        method: "POST",
      }),
      transformResponse: (r: ApiEnvelope<Advance>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [
        { type: "Advance", id: `LIST-${farmId}` },
        { type: "Expense", id: `LIST-${farmId}` },
      ],
    }),
    getMyAdvances: build.query<Advance[], { farmId: number }>({
      query: ({ farmId }) => `/api/v1/my/advances?farmId=${farmId}`,
      transformResponse: (r: ApiEnvelope<Advance[]>) => r.data,
      providesTags: (_r, _e, { farmId }) => [{ type: "Advance", id: `MINE-${farmId}` }],
    }),
    requestAdvance: build.mutation<Advance, { body: AdvanceInput }>({
      query: ({ body }) => ({
        url: `/api/v1/my/advances`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<Advance>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: "Advance", id: `MINE-${body.farmId}` },
        { type: "Advance", id: `LIST-${body.farmId}` },
      ],
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
  useGetSalarySettingsQuery,
  useUpsertSalarySettingMutation,
  useGetSalariesQuery,
  useGenerateSalariesMutation,
  usePaySalaryMutation,
  useGetAdvancesQuery,
  useApproveAdvanceMutation,
  useRejectAdvanceMutation,
  useGetMyAdvancesQuery,
  useRequestAdvanceMutation,
} = financeApi;
