import { baseApi } from "./baseApi";
import type {
  LifecycleEvent,
  MortalityInput,
  ProductionUnit,
  ProductionUnitInput,
  UnitEventInput,
} from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

/**
 * Generic production-units listing (gated only by farm access, no module flag).
 * Used by the layer pages to enumerate units; layer units are filtered by their
 * breed type via {@link breedsApi}.
 */
export const productionUnitsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProductionUnits: build.query<ProductionUnit[], { farmId: number }>({
      query: ({ farmId }) => `/api/v1/farms/${farmId}/production-units`,
      transformResponse: (r: ApiEnvelope<ProductionUnit[]>) => r.data,
      providesTags: [{ type: "ProductionUnit", id: "LIST" }],
    }),
    getProductionUnit: build.query<
      ProductionUnit,
      { farmId: number; unitId: number }
    >({
      query: ({ farmId, unitId }) =>
        `/api/v1/farms/${farmId}/production-units/${unitId}`,
      transformResponse: (r: ApiEnvelope<ProductionUnit>) => r.data,
      providesTags: (_r, _e, { unitId }) => [
        { type: "ProductionUnit", id: unitId },
      ],
    }),
    createProductionUnit: build.mutation<
      ProductionUnit,
      { farmId: number; body: ProductionUnitInput }
    >({
      query: ({ farmId, body }) => ({
        url: `/api/v1/farms/${farmId}/production-units`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<ProductionUnit>) => r.data,
      invalidatesTags: [{ type: "ProductionUnit", id: "LIST" }],
    }),
    getUnitEvents: build.query<
      LifecycleEvent[],
      { farmId: number; unitId: number }
    >({
      query: ({ farmId, unitId }) =>
        `/api/v1/farms/${farmId}/production-units/${unitId}/events`,
      transformResponse: (r: ApiEnvelope<LifecycleEvent[]>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: "UnitEvent", id: unitId }],
    }),
    recordMortality: build.mutation<
      LifecycleEvent,
      { farmId: number; unitId: number; body: MortalityInput }
    >({
      query: ({ farmId, unitId, body }) => ({
        url: `/api/v1/farms/${farmId}/production-units/${unitId}/mortality`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<LifecycleEvent>) => r.data,
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "ProductionUnit", id: unitId },
        { type: "ProductionUnit", id: "LIST" },
        { type: "UnitEvent", id: unitId },
      ],
    }),
    recordUnitEvent: build.mutation<
      LifecycleEvent,
      { farmId: number; unitId: number; body: UnitEventInput }
    >({
      query: ({ farmId, unitId, body }) => ({
        url: `/api/v1/farms/${farmId}/production-units/${unitId}/events`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<LifecycleEvent>) => r.data,
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "ProductionUnit", id: unitId },
        { type: "ProductionUnit", id: "LIST" },
        { type: "UnitEvent", id: unitId },
      ],
    }),
  }),
});

export const {
  useGetProductionUnitsQuery,
  useGetProductionUnitQuery,
  useCreateProductionUnitMutation,
  useGetUnitEventsQuery,
  useRecordMortalityMutation,
  useRecordUnitEventMutation,
} = productionUnitsApi;
