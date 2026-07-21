/**
 * `listProductionUnits` RTK Query endpoint: URL + `ApiResponse` unwrap,
 * per-farmId cache keying, and — the offline requirement (task 8 brief) —
 * that a previously-successful query keeps its cached `data` after a
 * failed refetch.
 *
 * Exercised against a real store + `baseApi.middleware` with `global.fetch`
 * mocked (no native modules involved, runs in plain Node). `getAccessToken`
 * (SecureStore) resolves to `null` here since no token is stored in this
 * process — `prepareHeaders` handles that already (no Authorization header
 * added), so the request still goes out; only the URL and body matter for
 * these assertions.
 */
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../baseApi';
import { productionUnitsApi, type ProductionUnit } from '../productionUnitsApi';

function makeStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    // RTK's default `autoBatchEnhancer` batches low-priority dispatches via
    // `window.requestAnimationFrame`; without a `window` (this is a plain
    // Node test) it falls back to its own `setTimeout(fn, 10)` queue, which
    // can still be pending when Jest tears the environment down between
    // test files. Not needed for these assertions — every dispatch here is
    // already awaited.
    enhancers: (getDefaultEnhancers) => getDefaultEnhancers({ autoBatch: false }),
  });
}

function unit(overrides: Partial<ProductionUnit> = {}): ProductionUnit {
  return {
    id: 1,
    farmId: 7,
    species: 'POULTRY',
    unitKind: 'BATCH',
    breedId: 3,
    name: 'Lot B-12',
    startDate: '2026-06-01',
    endDate: null,
    currentCount: 480,
    status: 'ACTIVE',
    ...overrides,
  };
}

function okResponse(body: unknown): Response {
  // A real `Response` (Node's native fetch globals) — `fetchBaseQuery`
  // calls `response.clone()` internally, which a hand-rolled stub object
  // doesn't implement.
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function networkFailure(): Promise<Response> {
  return Promise.reject(new TypeError('Network request failed'));
}

describe('listProductionUnits', () => {
  const fetchMock = jest.fn();
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    store = makeStore();
  });

  afterEach(() => {
    // RTK Query schedules a `keepUnusedDataFor` removal timeout (60s by
    // default) per cache entry on unsubscribe; `resetApiState` is what
    // clears every one of those internally (see RTK Query's core
    // middleware). Without this, Jest tears down the test environment
    // while those real timers are still pending, and they fire afterwards
    // against a torn-down global — noisy but harmless, still worth avoiding.
    store.dispatch(baseApi.util.resetApiState());
  });

  it('calls GET /api/v1/farms/{farmId}/production-units and unwraps ApiResponse.data', async () => {
    const units = [unit()];
    fetchMock.mockReturnValueOnce(okResponse({ data: units }));

    const result = await store.dispatch(
      productionUnitsApi.endpoints.listProductionUnits.initiate(7),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // `fetchBaseQuery` calls `fetch(new Request(url, init))` under Node's
    // native fetch — the mock's sole argument is that `Request`, not a bare
    // URL string.
    const requestArg = fetchMock.mock.calls[0]?.[0] as string | Request;
    const calledUrl = typeof requestArg === 'string' ? requestArg : requestArg.url;
    expect(calledUrl).toContain('/api/v1/farms/7/production-units');
    expect(result.data).toEqual(units);
  });

  it('keys the cache per farmId — two farms are two separate entries', async () => {
    const unitsForFarm7 = [unit({ id: 1, farmId: 7, name: 'Lot B-12' })];
    const unitsForFarm9 = [unit({ id: 2, farmId: 9, name: 'Lot C-01' })];
    fetchMock
      .mockReturnValueOnce(okResponse({ data: unitsForFarm7 }))
      .mockReturnValueOnce(okResponse({ data: unitsForFarm9 }));

    const forFarm7 = await store.dispatch(
      productionUnitsApi.endpoints.listProductionUnits.initiate(7),
    );
    const forFarm9 = await store.dispatch(
      productionUnitsApi.endpoints.listProductionUnits.initiate(9),
    );

    expect(forFarm7.data).toEqual(unitsForFarm7);
    expect(forFarm9.data).toEqual(unitsForFarm9);

    // Both cache entries coexist independently in the store.
    const select7 = productionUnitsApi.endpoints.listProductionUnits.select(7);
    const select9 = productionUnitsApi.endpoints.listProductionUnits.select(9);
    expect(select7(store.getState())?.data).toEqual(unitsForFarm7);
    expect(select9(store.getState())?.data).toEqual(unitsForFarm9);
  });

  it('keeps the last successful data available after a failed refetch (offline)', async () => {
    const units = [unit()];
    fetchMock.mockReturnValueOnce(okResponse({ data: units }));

    // Subscribe (don't unsubscribe) so the cache entry stays alive for the
    // forced refetch below, exactly like a mounted `useListProductionUnitsQuery`.
    const subscription = store.dispatch(
      productionUnitsApi.endpoints.listProductionUnits.initiate(7),
    );
    await subscription;

    const select = productionUnitsApi.endpoints.listProductionUnits.select(7);
    expect(select(store.getState())?.data).toEqual(units);

    // Network drops: the refetch rejects entirely (not an HTTP error status).
    fetchMock.mockReturnValueOnce(networkFailure());
    await store.dispatch(
      productionUnitsApi.endpoints.listProductionUnits.initiate(7, { forceRefetch: true }),
    );

    const afterFailure = select(store.getState());
    expect(afterFailure?.isError).toBe(true);
    // The offline requirement: cached data from the last success is still there.
    expect(afterFailure?.data).toEqual(units);

    subscription.unsubscribe();
  });
});
