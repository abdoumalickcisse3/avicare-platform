/**
 * Breed reference — `GET /api/v1/breeds?species=...`. Shape mirrors the
 * backend `BreedResponse` record verbatim (task 9 brief), mirroring task 8's
 * `productionUnitsApi` pattern. Platform-level reference data (not
 * farm-scoped): a single cache entry per species is shared by every screen
 * that needs to resolve a `breedId` to a display name.
 */
import { baseApi } from './baseApi';

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

export interface Breed {
  id: number;
  species: string;
  code: string;
  name: string;
  /** broiler|layer for poultry; null for species where the split doesn't apply. */
  type: string | null;
  /** null = platform breed, shared by every farm. */
  farmId: number | null;
  active: boolean;
}

export const breedsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listBreeds: build.query<Breed[], string>({
      query: (species) => `/api/v1/breeds?species=${species}`,
      transformResponse: (r: ApiEnvelope<Breed[]>) => r.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map((b) => ({ type: 'Breed' as const, id: b.id })),
              { type: 'Breed' as const, id: 'LIST' },
            ]
          : [{ type: 'Breed' as const, id: 'LIST' }],
    }),
  }),
});

export const { useListBreedsQuery } = breedsApi;
