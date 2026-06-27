import { baseApi } from "./baseApi";
import type { DashboardResponse } from "@/types/dashboard";

interface ApiEnvelope<T> {
  data: T;
}

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query<
      DashboardResponse,
      { farmId: number; query: Record<string, string> }
    >({
      query: ({ farmId, query }) => ({
        url: `/api/v1/farms/${farmId}/dashboard`,
        params: query,
      }),
      transformResponse: (r: ApiEnvelope<DashboardResponse>) => r.data,
      providesTags: [{ type: "Dashboard", id: "current" }],
    }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
