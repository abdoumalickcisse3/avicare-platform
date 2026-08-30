/**
 * Farms list — mirrors `web/src/store/api/farmsApi.ts`'s `getMyFarms`, only
 * the fields task 8 needs (see task brief: id/name are enough for the field
 * selector; the full web `Farm` shape carries settings this app never
 * reads).
 */
import { baseApi } from './baseApi';

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

export interface Farm {
  id: number;
  name: string;
  /** These come from the same backend payload as the web `Farm`; optional so
   *  older/minimal responses don't break typing. */
  description?: string | null;
  location?: string | null;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  capacity?: number | null;
  timezone?: string | null;
  currency?: string | null;
  active?: boolean;
  createdAt?: string;
  /** Métier focus tokens: "broiler" / "layer". */
  productionFocus?: string[];
}

/**
 * `PUT /farms/{id}` is a REPLACEMENT, not a patch: the service assigns
 * description, location, gps and capacity straight from the request, so any
 * field left out is written as null and the value is lost. Only timezone,
 * currency and productionFocus are protected by an explicit null check.
 *
 * Callers must therefore send the farm back whole. `FarmInput` makes that hard
 * to get wrong by keeping every erasable field in one place.
 */
export interface FarmInput {
  name: string;
  description?: string | null;
  location?: string | null;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  capacity?: number | null;
  timezone?: string;
  currency?: string;
  productionFocus?: string[];
}

export const farmsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listFarms: build.query<Farm[], void>({
      query: () => '/api/v1/farms',
      transformResponse: (r: ApiEnvelope<Farm[]>) => r.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map((f) => ({ type: 'Farm' as const, id: f.id })),
              { type: 'Farm' as const, id: 'LIST' },
            ]
          : [{ type: 'Farm' as const, id: 'LIST' }],
    }),
    getFarm: build.query<Farm, number>({
      query: (id) => `/api/v1/farms/${id}`,
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      providesTags: (_r, _e, id) => [{ type: 'Farm', id }],
    }),
    createFarm: build.mutation<Farm, FarmInput>({
      query: (body) => ({ url: '/api/v1/farms', method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      invalidatesTags: [{ type: 'Farm', id: 'LIST' }],
    }),
    updateFarm: build.mutation<Farm, { id: number; body: FarmInput }>({
      query: ({ id, body }) => ({ url: `/api/v1/farms/${id}`, method: 'PUT', body }),
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Farm', id },
        { type: 'Farm', id: 'LIST' },
      ],
    }),
    /**
     * Soft delete (`@SQLDelete` sets `deleted_at`), OWNER only, and the server applies no
     * further guard: a farm with live flocks goes just as quietly as an empty one.
     */
    deleteFarm: build.mutation<void, number>({
      query: (id) => ({ url: `/api/v1/farms/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Farm', id: 'LIST' }],
    }),
  }),
});

export const {
  useListFarmsQuery,
  useGetFarmQuery,
  useCreateFarmMutation,
  useUpdateFarmMutation,
  useDeleteFarmMutation,
} = farmsApi;
