/**
 * Production units (batches/lots) for a farm — `GET
 * /api/v1/farms/{farmId}/production-units`. Shape mirrors the backend
 * `ProductionUnitResponse` record verbatim (task 8 brief); `species` and
 * `status` are backend enum strings but typed as plain `string` here — this
 * screen never branches on their values, so no local enum duplication.
 */
import { baseApi } from './baseApi';

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

export interface ProductionUnit {
  id: number;
  farmId: number;
  species: string;
  unitKind: 'BATCH' | 'INDIVIDUAL';
  breedId: number | null;
  name: string;
  startDate: string;
  endDate: string | null;
  currentCount: number;
  status: string;
}

export const productionUnitsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listProductionUnits: build.query<ProductionUnit[], number>({
      query: (farmId) => `/api/v1/farms/${farmId}/production-units`,
      transformResponse: (r: ApiEnvelope<ProductionUnit[]>) => r.data,
      providesTags: (result, _error, farmId) =>
        result
          ? [
              ...result.map((u) => ({ type: 'ProductionUnit' as const, id: u.id })),
              { type: 'ProductionUnit' as const, id: `LIST-${farmId}` },
            ]
          : [{ type: 'ProductionUnit' as const, id: `LIST-${farmId}` }],
    }),
  }),
});

export const { useListProductionUnitsQuery } = productionUnitsApi;
