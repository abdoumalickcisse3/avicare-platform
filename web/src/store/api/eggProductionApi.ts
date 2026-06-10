import { baseApi } from "./baseApi";
import type {
  DailyProduction,
  EggCollection,
  EggCollectionInput,
  LayerConfigEntry,
  RollingRate,
  TraySettings,
  TrayStock,
  TrayStockAdjustInput,
  TrayStockUpdateInput,
} from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/egg-production`;

/**
 * Egg-production module (Sprint B2) — collections, tray stock, daily-production
 * aggregates and read-only config. All endpoints are gated behind
 * {@code module.poultry.layer}; a 403 surfaces as a feature lock in the UI.
 */
export const eggProductionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /* --- Collections --------------------------------------------------- */
    getCollections: build.query<
      EggCollection[],
      { farmId: number; unitId: number; from?: string; to?: string }
    >({
      query: ({ farmId, unitId, from, to }) => {
        const params = new URLSearchParams({ unitId: String(unitId) });
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        return `${base(farmId)}/collections?${params.toString()}`;
      },
      transformResponse: (r: ApiEnvelope<EggCollection[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: "EggCollection", id: unitId }],
    }),
    recordCollection: build.mutation<
      EggCollection,
      { farmId: number; body: EggCollectionInput }
    >({
      query: ({ farmId, body }) => ({
        url: `${base(farmId)}/collections`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<EggCollection>) => r.data,
      invalidatesTags: (_r, _e, { body }) => [
        { type: "EggCollection", id: body.unitId },
        { type: "DailyProduction", id: body.unitId },
      ],
    }),
    deleteCollection: build.mutation<
      void,
      { farmId: number; id: number; unitId: number }
    >({
      query: ({ farmId, id }) => ({
        url: `${base(farmId)}/collections/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "EggCollection", id: unitId },
        { type: "DailyProduction", id: unitId },
      ],
    }),

    /* --- Tray stock ---------------------------------------------------- */
    getTrayStock: build.query<TrayStock, { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/tray-stock`,
      transformResponse: (r: ApiEnvelope<TrayStock>) => r.data,
      providesTags: [{ type: "TrayStock", id: "CURRENT" }],
    }),
    updateTrayStock: build.mutation<
      TrayStock,
      { farmId: number; body: TrayStockUpdateInput }
    >({
      query: ({ farmId, body }) => ({
        url: `${base(farmId)}/tray-stock`,
        method: "PUT",
        body,
      }),
      transformResponse: (r: ApiEnvelope<TrayStock>) => r.data,
      invalidatesTags: [{ type: "TrayStock", id: "CURRENT" }],
    }),
    adjustTrayStock: build.mutation<
      TrayStock,
      { farmId: number; body: TrayStockAdjustInput }
    >({
      query: ({ farmId, body }) => ({
        url: `${base(farmId)}/tray-stock/adjust`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<TrayStock>) => r.data,
      invalidatesTags: [{ type: "TrayStock", id: "CURRENT" }],
    }),

    /* --- Daily production --------------------------------------------- */
    getDailyProductions: build.query<
      DailyProduction[],
      { farmId: number; unitId: number; from?: string; to?: string }
    >({
      query: ({ farmId, unitId, from, to }) => {
        const params = new URLSearchParams({ unitId: String(unitId) });
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        return `${base(farmId)}/daily-production?${params.toString()}`;
      },
      transformResponse: (r: ApiEnvelope<DailyProduction[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: "DailyProduction", id: unitId }],
    }),
    getRollingRate: build.query<
      RollingRate,
      { farmId: number; unitId: number; days?: number }
    >({
      query: ({ farmId, unitId, days = 7 }) =>
        `${base(farmId)}/daily-production/${unitId}/rolling-rate?days=${days}`,
      transformResponse: (r: ApiEnvelope<RollingRate>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: "DailyProduction", id: unitId }],
    }),
    closeDay: build.mutation<
      DailyProduction,
      { farmId: number; unitId: number; date?: string }
    >({
      query: ({ farmId, unitId, date }) => ({
        url: `${base(farmId)}/daily-production/${unitId}/close${date ? `?date=${date}` : ""}`,
        method: "POST",
      }),
      transformResponse: (r: ApiEnvelope<DailyProduction>) => r.data,
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "DailyProduction", id: unitId },
      ],
    }),

    /* --- Read-only config --------------------------------------------- */
    getTimeslots: build.query<LayerConfigEntry[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/config/timeslots`,
      transformResponse: (r: ApiEnvelope<LayerConfigEntry[]>) => r.data,
      providesTags: [{ type: "LayerConfig", id: "TIMESLOTS" }],
    }),
    getGrades: build.query<LayerConfigEntry[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/config/grades`,
      transformResponse: (r: ApiEnvelope<LayerConfigEntry[]>) => r.data,
      providesTags: [{ type: "LayerConfig", id: "GRADES" }],
    }),
    getTraySettings: build.query<TraySettings, { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/config/tray-settings`,
      transformResponse: (r: ApiEnvelope<TraySettings>) => r.data,
      providesTags: [{ type: "LayerConfig", id: "TRAY_SETTINGS" }],
    }),
  }),
});

export const {
  useGetCollectionsQuery,
  useRecordCollectionMutation,
  useDeleteCollectionMutation,
  useGetTrayStockQuery,
  useUpdateTrayStockMutation,
  useAdjustTrayStockMutation,
  useGetDailyProductionsQuery,
  useGetRollingRateQuery,
  useCloseDayMutation,
  useGetTimeslotsQuery,
  useGetGradesQuery,
  useGetTraySettingsQuery,
} = eggProductionApi;
