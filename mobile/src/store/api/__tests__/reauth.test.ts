import { configureStore } from '@reduxjs/toolkit';

jest.mock('@/auth/tokens', () => ({
  getAccessToken: jest.fn(async () => 'old'),
  getRefreshToken: jest.fn(async () => 'refresh-1'),
  saveTokens: jest.fn(async () => {}),
  clearTokens: jest.fn(async () => {}),
}));
jest.mock('@/config/apiUrl', () => ({ resolveApiUrl: () => 'https://api.test' }));

import { clearTokens } from '@/auth/tokens';
import { baseApi } from '../baseApi';
import { dashboardApi } from '../dashboardApi';
import { authApi } from '../authApi';

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function makeStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (gdm) => gdm().concat(baseApi.middleware),
  });
}

const query = { farmId: 7, query: { period: { kind: 'preset', value: '30d' } } } as never;

describe('baseApi 401 handling', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('refreshes ONCE for several queries that answer 401 together, then replays each', async () => {
    let refreshCalls = 0;
    let refreshed = false;
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = (input as Request).url ?? String(input);
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshCalls += 1;
        refreshed = true;
        return json(200, { data: { accessToken: 'new', refreshToken: 'refresh-2' } });
      }
      return refreshed ? json(200, { data: {} }) : json(401);
    }) as unknown as typeof fetch;

    const store = makeStore();
    const results = await Promise.all([
      store.dispatch(dashboardApi.endpoints.getDashboard.initiate({ ...(query as object), farmId: 1 } as never)),
      store.dispatch(dashboardApi.endpoints.getDashboard.initiate({ ...(query as object), farmId: 2 } as never)),
      store.dispatch(dashboardApi.endpoints.getDashboard.initiate({ ...(query as object), farmId: 3 } as never)),
    ]);

    expect(refreshCalls).toBe(1);
    expect(results.every((r) => r.isSuccess)).toBe(true);
  });

  it('does not sign the user out when the refresh fails only because the network is down', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = (input as Request).url ?? String(input);
      if (url.endsWith('/api/v1/auth/refresh')) throw new Error('Network request failed');
      return json(401);
    }) as unknown as typeof fetch;

    const store = makeStore();
    const result = await store.dispatch(dashboardApi.endpoints.getDashboard.initiate(query));

    expect(result.isError).toBe(true);
    expect(clearTokens).not.toHaveBeenCalled();
  });

  it('does not try to refresh when a login attempt is refused', async () => {
    const fetchMock = jest.fn(async () => json(401, { detail: 'Bad credentials' }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const store = makeStore();
    const result = await store.dispatch(
      authApi.endpoints.login.initiate({ email: 'a@b.c', password: 'x' } as never),
    );

    expect('error' in result && result.error).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
