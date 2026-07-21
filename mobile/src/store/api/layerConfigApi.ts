/**
 * Layer farm configuration — read-only catalog entries such as the egg
 * collection time-slots. `GET /api/v1/farms/{farmId}/egg-production/config/timeslots`,
 * mirroring the backend `LayerConfigEntryResponse` record verbatim (task 13
 * brief), following the same pattern as `breedsApi`/`productionUnitsApi`.
 *
 * This exists for one reason: doc 00's "Règle d'or n°0" — no hardcoded
 * business values. The egg collection screen (task 13) must not hardcode a
 * list of time-slots (morning/noon/evening); it fetches the farm's actual
 * configured set and lets the farmer pick from it.
 */
import { baseApi } from './baseApi';

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

export interface LayerConfigEntry {
  key: string;
  value: Record<string, unknown>;
}

export const layerConfigApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listTimeslots: build.query<LayerConfigEntry[], number>({
      query: (farmId) => `/api/v1/farms/${farmId}/egg-production/config/timeslots`,
      transformResponse: (r: ApiEnvelope<LayerConfigEntry[]>) => r.data,
      providesTags: (result, _error, farmId) =>
        result
          ? [
              ...result.map((e) => ({ type: 'LayerConfig' as const, id: e.key })),
              { type: 'LayerConfig' as const, id: `LIST-${farmId}` },
            ]
          : [{ type: 'LayerConfig' as const, id: `LIST-${farmId}` }],
    }),
  }),
});

export const { useListTimeslotsQuery } = layerConfigApi;
