import { baseApi } from "@/store/api/baseApi";
import type { BenchmarkComparison } from "@/types";

interface Envelope<T> {
  data: T;
}

/** "You versus the average" — served only when the platform enables it and the cohort is big enough. */
export const benchmarksApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBenchmarkComparison: build.query<BenchmarkComparison, { farmId: number }>({
      query: ({ farmId }) => `/api/v1/farms/${farmId}/benchmarks`,
      transformResponse: (r: Envelope<BenchmarkComparison>) => r.data,
    }),
  }),
});

export const { useGetBenchmarkComparisonQuery } = benchmarksApi;
