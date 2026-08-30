/**
 * Egg production — ported from `web/src/store/api/eggProductionApi.ts` (same
 * backend). Only the reads the mobile Œufs screens need: tray stock, rolling
 * laying rate, and a unit's collections. Collection entry itself goes through
 * the offline sync queue, not this slice.
 */
import { baseApi } from './baseApi';
import type {
  DailyProduction,
  EggCollection,
  RollingRate,
  TrayStock,
  TrayStockAdjustInput,
  TrayStockUpdateInput,
  TraySettings,
} from '@/types';
import type { LayerConfigEntry } from './layerConfigApi';

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
    /**
     * Absolute tray count — use when someone has physically counted the store.
     * `adjustTrayStock` is the safer default for a collection round; see its note.
     */
    updateTrayStock: build.mutation<TrayStock, { farmId: number; body: TrayStockUpdateInput }>({
      query: ({ farmId, body }) => ({ url: `${base(farmId)}/tray-stock`, method: 'PUT', body }),
      transformResponse: (r: ApiEnvelope<TrayStock>) => r.data,
      invalidatesTags: [{ type: 'TrayStock', id: 'CURRENT' }],
    }),

    /** Relative correction — deltas compose where two absolute writes would overwrite. */
    adjustTrayStock: build.mutation<TrayStock, { farmId: number; body: TrayStockAdjustInput }>({
      query: ({ farmId, body }) => ({
        url: `${base(farmId)}/tray-stock/adjust`,
        method: 'POST',
        body,
      }),
      transformResponse: (r: ApiEnvelope<TrayStock>) => r.data,
      invalidatesTags: [{ type: 'TrayStock', id: 'CURRENT' }],
    }),

    /** Removing a collection re-opens the day's totals, hence the DailyProduction invalidation. */
    deleteCollection: build.mutation<void, { farmId: number; id: number; unitId: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/collections/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: 'EggCollection', id: unitId },
        { type: 'DailyProduction', id: unitId },
      ],
    }),

    getGrades: build.query<LayerConfigEntry[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/config/grades`,
      transformResponse: (r: ApiEnvelope<LayerConfigEntry[]>) => r.data,
      providesTags: [{ type: 'LayerConfig', id: 'GRADES' }],
    }),

    getTraySettings: build.query<TraySettings, { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/config/tray-settings`,
      transformResponse: (r: ApiEnvelope<TraySettings>) => r.data,
      providesTags: [{ type: 'LayerConfig', id: 'TRAY-SETTINGS' }],
    }),
  }),
});

export const {
  useUpdateTrayStockMutation,
  useAdjustTrayStockMutation,
  useDeleteCollectionMutation,
  useGetGradesQuery,
  useGetTraySettingsQuery,
  useGetTrayStockQuery,
  useGetRollingRateQuery,
  useGetCollectionsQuery,
  useGetDailyProductionsQuery,
  useCloseDayMutation,
} = eggProductionApi;
