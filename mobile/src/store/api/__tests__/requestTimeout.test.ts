import { configureStore } from '@reduxjs/toolkit';

jest.mock('@/auth/tokens', () => ({
  getAccessToken: jest.fn(async () => null),
  getRefreshToken: jest.fn(async () => null),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
}));

import { baseApi } from '../baseApi';
import { dashboardApi } from '../dashboardApi';

describe('baseApi request timeout', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  it('fails a request that never answers instead of leaving the screen loading forever', async () => {
    jest.useFakeTimers();
    // A hung connection: only ends when the request is aborted.
    global.fetch = jest.fn(
      (input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = (input as Request).signal ?? init?.signal;
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ) as unknown as typeof fetch;

    const store = configureStore({
      reducer: { [baseApi.reducerPath]: baseApi.reducer },
      middleware: (gdm) => gdm().concat(baseApi.middleware),
    });
    const pending = store.dispatch(
      dashboardApi.endpoints.getDashboard.initiate({ farmId: 7, query: { period: { kind: 'preset', value: '30d' } } } as never),
    );
    await jest.advanceTimersByTimeAsync(30_000);
    const result = await pending;
    expect(result.isError).toBe(true);
    expect(result.isLoading).toBe(false);
  });
});
