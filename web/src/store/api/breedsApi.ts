import { baseApi } from "./baseApi";
import type { Breed } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

export const breedsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBreeds: build.query<Breed[], void>({
      query: () => "/api/v1/breeds",
      transformResponse: (r: ApiEnvelope<Breed[]>) => r.data,
      providesTags: ["Breed"],
    }),
  }),
});

export const { useGetBreedsQuery } = breedsApi;
