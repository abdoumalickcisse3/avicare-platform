import { baseApi } from './baseApi';
interface ApiEnvelope<T> {
  data: T;
}

/**
 * Anonymous comparison against other farms.
 *
 * `available` false means the platform has it off or the cohort is too small — the screen shows
 * the reason, never a zero that would read as a real figure.
 */
export type BenchmarkComparison = {
  available: boolean;
  unavailableReason: string | null;
  cohortSize: number;
  platformMortalityRate: string | null;
  farmMortalityRate: string | null;
};

export const benchmarksApi = baseApi.injectEndpoints({
  overrideExisting: __DEV__,
  endpoints: (build) => ({
    getBenchmarkComparison: build.query<BenchmarkComparison, { farmId: number }>({
      query: ({ farmId }) => `/api/v1/farms/${farmId}/benchmarks`,
      transformResponse: (r: ApiEnvelope<BenchmarkComparison>) => r.data,
    }),
  }),
});

export const { useGetBenchmarkComparisonQuery } = benchmarksApi;
