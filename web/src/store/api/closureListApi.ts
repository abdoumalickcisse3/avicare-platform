import { baseApi } from "./baseApi";
import type { ClosureSummary } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

/** The farm's closed cycles, side by side — mirrors the backend `ClosureListController`. */
export const closureListApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getFarmClosures: build.query<ClosureSummary[], { farmId: number }>({
      query: ({ farmId }) => `/api/v1/farms/${farmId}/closures`,
      transformResponse: (r: ApiEnvelope<ClosureSummary[]>) => r.data,
      providesTags: [{ type: "UnitClosure", id: "LIST" }],
    }),
  }),
});

export const { useGetFarmClosuresQuery } = closureListApi;
