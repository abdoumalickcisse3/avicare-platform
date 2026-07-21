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
  }),
});

export const { useListFarmsQuery } = farmsApi;
