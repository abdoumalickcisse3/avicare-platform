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

/** A unit lifecycle event (mirrors the web `LifecycleEvent`): CREATED /
 * MORTALITY / REFORM / COUNT_ADJUSTMENT / SALE / SALE_CANCEL. */
export interface LifecycleEvent {
  id: number;
  productionUnitId: number;
  eventType: string;
  quantityDelta: number;
  reason: string | null;
  details: Record<string, unknown>;
  occurredAt: string;
}

export interface ProductionUnitInput {
  breedId: number;
  name?: string;
  startDate: string;
  initialCount: number;
}

export const productionUnitsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createProductionUnit: build.mutation<ProductionUnit, { farmId: number; body: ProductionUnitInput }>({
      query: ({ farmId, body }) => ({
        url: `/api/v1/farms/${farmId}/production-units`,
        method: 'POST',
        body,
      }),
      transformResponse: (r: ApiEnvelope<ProductionUnit>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [{ type: 'ProductionUnit' as const, id: `LIST-${farmId}` }],
    }),
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
    getUnitEvents: build.query<LifecycleEvent[], { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => `/api/v1/farms/${farmId}/production-units/${unitId}/events`,
      transformResponse: (r: ApiEnvelope<LifecycleEvent[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: 'ProductionUnit' as const, id: `events-${unitId}` }],
    }),
  }),
});

export const {
  useCreateProductionUnitMutation,
  useListProductionUnitsQuery,
  useGetUnitEventsQuery,
} = productionUnitsApi;
