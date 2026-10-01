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
import { getAccessToken } from '@/auth/tokens';
import { refreshSession } from '@/auth/refreshSession';
import { resolveApiUrl } from '@/config/apiUrl';
import { REQUEST_TIMEOUT_MS } from '@/config/requestTimeout';

const API_URL = resolveApiUrl();

export { REQUEST_TIMEOUT_MS };

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  prepareHeaders: async (headers) => {
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

const urlOf = (args: string | FetchArgs): string => (typeof args === 'string' ? args : args.url);

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  // A 401 on /auth/* is a wrong password or a dead refresh token, not an expired access token:
  // refreshing there would only loop.
  if (result.error?.status !== 401 || urlOf(args).startsWith('/api/v1/auth/')) return result;

  // Shared with every other caller (see refreshSession): a second concurrent refresh would replay
  // a single-use token and get the whole account signed out.
  const outcome = await refreshSession();
  if (outcome === 'refreshed') return rawBaseQuery(args, api, extraOptions);
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
    'StockItem', 'InventoryAlert', 'FeedFormula', 'InventoryCatalog', 'PurchaseOrder',
    'Client', 'Catalog', 'Supplier',
    'Sale', 'Invoice', 'Payment', 'Order', 'Delivery',
    'Expense', 'Salary', 'Member',
    'Notification', 'Partner',
  
    // Declared ahead of the endpoints that will use them (parity spec 2026-08-30). A missing
    // tagType fails invalidation *silently*: the mutation succeeds, the screen does not
    // refresh, and the bug looks like a caching problem rather than a missing declaration.
    'User',
    'Permission',
    'Setting',
    'Subscription',
    'UnitEvent',
    'Treatment',
    'Veterinarian',
    'VetVisit',
    'HealthProgram',
    'HealthSchedule',
    'StockMovement',
    'Advance',
    'UnitClosure',
  ],
  endpoints: () => ({}),
});
