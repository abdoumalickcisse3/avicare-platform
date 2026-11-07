import { baseApi } from "./baseApi";
import type { Breed, DeclareBreedInput } from "@/types";

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
    /**
     * Declares a breed the catalogue does not have. Gated OWNER/MANAGER by role on the backend
     * (`FarmBreedController` — `@farmAccess.hasRole(#farmId, OWNER, MANAGER)`), not by permission.
     */
    declareBreed: build.mutation<Breed, { farmId: number; body: DeclareBreedInput }>({
      query: ({ farmId, body }) => ({
        url: `/api/v1/farms/${farmId}/breeds`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<Breed>) => r.data,
      invalidatesTags: ["Breed"],
    }),
  }),
});

export const { useGetBreedsQuery, useDeclareBreedMutation } = breedsApi;
