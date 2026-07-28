/**
 * Egg production — ported from `web/src/store/api/eggProductionApi.ts` (same
 * backend). Only the reads the mobile Œufs screens need: tray stock, rolling
 * laying rate, and a unit's collections. Collection entry itself goes through
 * the offline sync queue, not this slice.
 */
import { baseApi } from './baseApi';
import type { DailyProduction, EggCollection, RollingRate, TrayStock } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/egg-production`;

export const eggProductionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTrayStock: build.query<TrayStock, { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/tray-stock`,
      transformResponse: (r: ApiEnvelope<TrayStock>) => r.data,
      providesTags: [{ type: 'TrayStock', id: 'CURRENT' }],
    }),
    getRollingRate: build.query<RollingRate, { farmId: number; unitId: number; days?: number }>({
      query: ({ farmId, unitId, days = 7 }) => `${base(farmId)}/daily-production/${unitId}/rolling-rate?days=${days}`,
      transformResponse: (r: ApiEnvelope<RollingRate>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'DailyProduction', id: unitId }],
    }),
    getCollections: build.query<EggCollection[], { farmId: number; unitId: number; from?: string; to?: string }>({
      query: ({ farmId, unitId, from, to }) => {
        const qs = new URLSearchParams({ unitId: String(unitId) });
        if (from) qs.set('from', from);
        if (to) qs.set('to', to);
        return `${base(farmId)}/collections?${qs.toString()}`;
      },
      transformResponse: (r: ApiEnvelope<EggCollection[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'EggCollection', id: unitId }],
    }),
    getDailyProductions: build.query<DailyProduction[], { farmId: number; unitId: number; from?: string; to?: string }>({
      query: ({ farmId, unitId, from, to }) => {
        const qs = new URLSearchParams({ unitId: String(unitId) });
        if (from) qs.set('from', from);
        if (to) qs.set('to', to);
        return `${base(farmId)}/daily-production?${qs.toString()}`;
      },
      transformResponse: (r: ApiEnvelope<DailyProduction[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'DailyProduction', id: unitId }],
    }),
    closeDay: build.mutation<DailyProduction, { farmId: number; unitId: number; date?: string }>({
      query: ({ farmId, unitId, date }) => ({
        url: `${base(farmId)}/daily-production/${unitId}/close${date ? `?date=${date}` : ''}`,
        method: 'POST',
      }),
      transformResponse: (r: ApiEnvelope<DailyProduction>) => r.data,
      // Closing a day auto-credits the farm tray stock (good eggs → trays), so
      // the tray-stock cache must refresh too.
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: 'DailyProduction', id: unitId },
        { type: 'TrayStock', id: 'CURRENT' },
      ],
    }),
  }),
});

export const {
  useGetTrayStockQuery,
  useGetRollingRateQuery,
  useGetCollectionsQuery,
  useGetDailyProductionsQuery,
  useCloseDayMutation,
} = eggProductionApi;
