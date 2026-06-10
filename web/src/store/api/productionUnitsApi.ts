import { baseApi } from "./baseApi";
import type { ProductionUnit } from "@/types";

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
  }),
});

export const { useGetProductionUnitsQuery, useGetProductionUnitQuery } =
  productionUnitsApi;
