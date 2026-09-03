/**
 * Closing a production cycle and reading its frozen report — mirrors
 * `web/src/store/api/closureApi.ts` (same backend, guards `poultry:read` to
 * read and OWNER/MANAGER to close or reopen).
 *
 * Online-only, like the sale and payment flows: closing returns a computed
 * report the screen has to show, and the offline queue can only replay a
 * fire-and-forget write. A cycle is closed once, from a place with signal —
 * not with one hand in a poultry house.
 */
import { baseApi } from './baseApi';

interface ApiEnvelope<T> {
  data: T;
}

/** Mirrors the backend `UnitClosureResponse` record verbatim. */
export interface UnitClosure {
  productionUnitId: number;
  closedAt: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  initialCount: number;
  remainingCount: number;
  deaths: number;
  mortalityPercent: number | null;
  exitWeightG: number | null;
  avgDailyGainG: number | null;
  totalFeedKg: number | null;
  feedConversionRatio: number | null;
  revenueXof: number;
  feedCostXof: number;
  chickCostXof: number;
  otherExpenseXof: number;
  totalCostXof: number;
  marginXof: number;
  costPerKgXof: number | null;
  consumedArticles: number;
  valuedArticles: number;
  /** Some consumed article carried no price: the cost is understated. */
  valuationIncomplete: boolean;
  notes: string | null;
}

export interface CloseUnitInput {
  chickCostXof?: number;
  notes?: string;
}

const base = (farmId: number, unitId: number) =>
  `/api/v1/farms/${farmId}/production-units/${unitId}`;

// Closing flips the unit's status, so the lists that filter on it must refetch —
// a missing tag here would leave a closed batch showing as active.
const closureTags = (farmId: number, unitId: number) =>
  [
    { type: 'UnitClosure', id: unitId },
    { type: 'ProductionUnit', id: unitId },
    { type: 'ProductionUnit', id: `LIST-${farmId}` },
    { type: 'PoultryBatch', id: 'LIST' },
    { type: 'UnitClosure', id: 'LIST' },
    { type: 'Dashboard', id: 'current' },
  ] as const;

export const closureApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getUnitClosure: build.query<UnitClosure, { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => `${base(farmId, unitId)}/closure`,
      transformResponse: (r: ApiEnvelope<UnitClosure>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'UnitClosure', id: unitId }],
    }),
    closeUnit: build.mutation<
      UnitClosure,
      { farmId: number; unitId: number; body: CloseUnitInput }
    >({
      query: ({ farmId, unitId, body }) => ({
        url: `${base(farmId, unitId)}/close`,
        method: 'POST',
        body,
      }),
      transformResponse: (r: ApiEnvelope<UnitClosure>) => r.data,
      invalidatesTags: (_r, _e, { farmId, unitId }) => [...closureTags(farmId, unitId)],
    }),
    reopenUnit: build.mutation<void, { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => ({
        url: `${base(farmId, unitId)}/closure`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { farmId, unitId }) => [...closureTags(farmId, unitId)],
    }),
  }),
});

export const { useGetUnitClosureQuery, useCloseUnitMutation, useReopenUnitMutation } =
  closureApi;
