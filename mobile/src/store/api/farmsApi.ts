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
  location?: string | null;
  capacity?: number | null;
  active?: boolean;
  /** Métier focus tokens: "broiler" / "layer". */
  productionFocus?: string[];
}

export interface FarmInput {
  name: string;
  description?: string;
  location?: string;
  capacity?: number;
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
    createFarm: build.mutation<Farm, FarmInput>({
      query: (body) => ({ url: '/api/v1/farms', method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      invalidatesTags: [{ type: 'Farm', id: 'LIST' }],
    }),
    updateFarm: build.mutation<Farm, { id: number; body: FarmInput }>({
      query: ({ id, body }) => ({ url: `/api/v1/farms/${id}`, method: 'PUT', body }),
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      invalidatesTags: [{ type: 'Farm', id: 'LIST' }],
    }),
  }),
});

export const { useListFarmsQuery, useCreateFarmMutation, useUpdateFarmMutation } = farmsApi;
