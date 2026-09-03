/**
 * The farm's closed cycles, side by side — mirrors `web/src/store/api/closureListApi.ts`.
 */
import { baseApi } from './baseApi';

interface ApiEnvelope<T> {
  data: T;
}

/** Mirrors the backend `ClosureSummaryResponse`. */
export interface ClosureSummary {
  productionUnitId: number;
  unitName: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  initialCount: number;
  deaths: number;
  mortalityPercent: number | null;
  exitWeightG: number | null;
  feedConversionRatio: number | null;
  revenueXof: number;
  totalCostXof: number;
  marginXof: number;
  costPerKgXof: number | null;
  /** The batch's feed could not be fully priced: its cost is understated. */
  valuationIncomplete: boolean;
}

export const closureListApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getFarmClosures: build.query<ClosureSummary[], { farmId: number }>({
      query: ({ farmId }) => `/api/v1/farms/${farmId}/closures`,
      transformResponse: (r: ApiEnvelope<ClosureSummary[]>) => r.data,
      providesTags: [{ type: 'UnitClosure', id: 'LIST' }],
    }),
  }),
});

export const { useGetFarmClosuresQuery } = closureListApi;
