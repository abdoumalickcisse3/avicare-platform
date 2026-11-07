/**
 * Breed reference — `GET /api/v1/breeds?species=...`. Shape mirrors the
 * backend `BreedResponse` record verbatim (task 9 brief), mirroring task 8's
 * `productionUnitsApi` pattern. Platform-level reference data (not
 * farm-scoped): a single cache entry per species is shared by every screen
 * that needs to resolve a `breedId` to a display name.
 *
 * `declareBreed` (task 7, souches-locales-ameliorees) lets a farm declare a breed the catalogue
 * does not have (Goliath, Kuroiler, "locale améliorée"...). Gated OWNER/MANAGER by ROLE on the
 * backend (`FarmBreedController` — `@farmAccess.hasRole(#farmId, OWNER, MANAGER)`), not by
 * permission — see `@/auth/roles` `canManageFarm`.
 */
import { baseApi } from './baseApi';

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

/**
 * The breed's production family (mirrors backend `BreedProfile`) — drives default targets and
 * whether a validated growth reference exists. `BROILER_RUSTIC` has no growth reference; the two
 * `LAYER_*` profiles carry no weight/age targets at all in this release (ponte is piloted by
 * laying rate, out of scope here).
 */
export type BreedProfile = 'BROILER_FAST' | 'BROILER_RUSTIC' | 'LAYER_INDUSTRIAL' | 'LAYER_RUSTIC';

export interface Breed {
  id: number;
  species: string;
  code: string;
  name: string;
  /** broiler|layer for poultry; null for species where the split doesn't apply. */
  type: string | null;
  /** Null for legacy/non-poultry breeds that never got a profile assigned. */
  profile: BreedProfile | null;
  /**
   * Resolved server-side from the breed's profile — null when the profile itself is null, or for
   * the two layer profiles (no targets declared for ponte in this release). Never invent a number
   * here: these live only in the backend catalog.
   */
  defaultTargetWeightG: number | null;
  defaultTargetAgeDays: number | null;
  /** null = platform breed, shared by every farm. */
  farmId: number | null;
  active: boolean;
}

/**
 * Declare a breed the catalogue does not have, mirrors backend `DeclareBreedRequest`. Send a
 * name, never a code: the code is computed server-side (slugify), and a divergent client-side
 * slugify once created two catalog entries for one product (PR #491). `species` defaults to
 * POULTRY server-side — V1 ships poultry only, so this is omitted here.
 */
export interface DeclareBreedInput {
  name: string;
  profile: BreedProfile;
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
    declareBreed: build.mutation<Breed, { farmId: number; body: DeclareBreedInput }>({
      query: ({ farmId, body }) => ({
        url: `/api/v1/farms/${farmId}/breeds`,
        method: 'POST',
        body,
      }),
      transformResponse: (r: ApiEnvelope<Breed>) => r.data,
      // Invalidates the shared `LIST` tag (not a per-species key) so every screen's
      // `useListBreedsQuery('POULTRY')` — the batch-creation pickers included — refetches and
      // picks up the newly declared breed without a manual reload.
      invalidatesTags: [{ type: 'Breed' as const, id: 'LIST' }],
    }),
  }),
});

export const { useListBreedsQuery, useDeclareBreedMutation } = breedsApi;
