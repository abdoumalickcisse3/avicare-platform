import { baseApi } from "./baseApi";
import type { CloseUnitInput, UnitClosure } from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

/**
 * Closing a production cycle and reading its frozen report.
 *
 * Closing and reopening invalidate the batch list as well: the "Clôturés" filter on
 * /elevage/lots reads the unit status, and it would otherwise keep showing a stale one.
 */
export const closureApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getUnitClosure: build.query<UnitClosure, { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) =>
        `/api/v1/farms/${farmId}/production-units/${unitId}/closure`,
      transformResponse: (r: ApiEnvelope<UnitClosure>) => r.data,
      providesTags: (_r, _e, { unitId }) => [{ type: "UnitClosure", id: unitId }],
    }),
    closeUnit: build.mutation<
      UnitClosure,
      { farmId: number; unitId: number; body: CloseUnitInput }
    >({
      query: ({ farmId, unitId, body }) => ({
        url: `/api/v1/farms/${farmId}/production-units/${unitId}/close`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<UnitClosure>) => r.data,
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "UnitClosure", id: unitId },
        { type: "ProductionUnit", id: unitId },
        { type: "PoultryBatch", id: unitId },
        { type: "PoultryBatch", id: "LIST" },
      ],
    }),
    reopenUnit: build.mutation<void, { farmId: number; unitId: number }>({
      query: ({ farmId, unitId }) => ({
        url: `/api/v1/farms/${farmId}/production-units/${unitId}/closure`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { unitId }) => [
        { type: "UnitClosure", id: unitId },
        { type: "ProductionUnit", id: unitId },
        { type: "PoultryBatch", id: unitId },
        { type: "PoultryBatch", id: "LIST" },
      ],
    }),
  }),
});

export const { useGetUnitClosureQuery, useCloseUnitMutation, useReopenUnitMutation } =
  closureApi;
