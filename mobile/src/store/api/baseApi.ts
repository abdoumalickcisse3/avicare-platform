/**
 * RTK Query base layer with 401-refresh, mirroring `web/src/store/api/baseApi.ts`.
 *
 * Differences from the web version (see task 4 brief):
 *  - Tokens live in `expo-secure-store`, which is async. `prepareHeaders` and
 *    the reauth wrapper both `await` the storage helpers instead of reading a
 *    synchronous cache.
 *  - There is no `window` to redirect from here. On an unrecoverable 401 we
 *    just clear the tokens; the `(field)/_layout.tsx` route guard reacts to
 *    the missing token and redirects to `(auth)/login` on its own.
 *
 * Backend contract unchanged: payloads are wrapped in `ApiResponse<T>`, so
 * endpoints use `transformResponse: (r) => r.data`. Refresh is
 * `POST /api/v1/auth/refresh` with `{ refreshToken }` in the body.
 */
import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '@/auth/tokens';
import { resolveApiUrl } from '@/config/apiUrl';

const API_URL = resolveApiUrl();

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: async (headers) => {
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      const refresh = await rawBaseQuery(
        { url: '/api/v1/auth/refresh', method: 'POST', body: { refreshToken } },
        api,
        extraOptions,
      );
      const data = (refresh.data as { data?: { accessToken: string; refreshToken: string } })
        ?.data;
      if (data?.accessToken && data.refreshToken) {
        await saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        result = await rawBaseQuery(args, api, extraOptions);
        return result;
      }
    }
    await clearTokens();
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth', 'Farm', 'ProductionUnit', 'Breed', 'LayerConfig', 'Dashboard',
    'PoultryBatch', 'DailyRecord', 'Weighing', 'Performance',
    'EggCollection', 'TrayStock', 'DailyProduction',
    'Vaccination', 'Observation',
    'HealthAlert', 'HealthCatalog',
    'StockItem', 'InventoryAlert', 'FeedFormula',
    'Client', 'Catalog', 'Supplier',
    'Sale', 'Invoice', 'Payment',
  ],
  endpoints: () => ({}),
});
