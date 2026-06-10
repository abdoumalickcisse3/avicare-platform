import { baseApi } from "./baseApi";
import type { Breed } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

/**
 * Breed reference. The backend `GET /api/v1/breeds` requires a `species` query
 * param (no default) — omitting it returns 400. We default to POULTRY (the only
 * species in V1) so existing call sites keep working; pass a species explicitly
 * for future ones.
 */
export const breedsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBreeds: build.query<Breed[], { species?: string } | void>({
      query: (arg) => `/api/v1/breeds?species=${arg?.species ?? "POULTRY"}`,
      transformResponse: (r: ApiEnvelope<Breed[]>) => r.data,
      providesTags: ["Breed"],
    }),
  }),
});

export const { useGetBreedsQuery } = breedsApi;
