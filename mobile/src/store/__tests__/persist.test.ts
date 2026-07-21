/**
 * Proves the token-leak fix for `@/store/persist`'s nested `api` config.
 *
 * The bug: RTK Query stores every mutation's resolved payload in
 * `state.api.mutations[requestId].data`. The `login` mutation
 * (`@/store/api/authApi.ts`) resolves to `AuthTokens`
 * (`{ accessToken, refreshToken }`), so a naive persist config that
 * whitelists the raw `api` slice (the old `persist.ts`) writes a plaintext
 * copy of both tokens to AsyncStorage on every login — on top of (and
 * outside of) the one place tokens are allowed to live:
 * `expo-secure-store`.
 *
 * These tests don't just assert on a whitelist/blacklist *string* — they
 * run the real login mutation through a real store, then feed the
 * resulting `state.api` through redux-persist's own `createPersistoid`
 * (the exact function `persistReducer` uses internally to decide what gets
 * written to storage) and inspect the bytes that would actually land in
 * AsyncStorage.
 */
import { configureStore } from '@reduxjs/toolkit';
import { createPersistoid, type PersistConfig } from 'redux-persist';
import { baseApi } from '../api/baseApi';
import { authApi } from '../api/authApi';
import { productionUnitsApi } from '../api/productionUnitsApi';
import { apiPersistConfig } from '../persist';

// The real native module isn't available under plain-Node Jest; use the
// package's own official mock (in-memory, real `jest.fn()`s) so
// `AsyncStorage.setItem` calls can be asserted on below.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
import AsyncStorage from '@react-native-async-storage/async-storage';

type ApiState = ReturnType<typeof baseApi.reducer>;

const FAKE_ACCESS_TOKEN = 'LEAK_ACCESS_TOKEN_a1b2c3';
const FAKE_REFRESH_TOKEN = 'LEAK_REFRESH_TOKEN_d4e5f6';
/** Marker proving the offline-cache feature (queries) still survives. */
const QUERY_MARKER_UNIT_NAME = 'Lot QUERY-CACHE-MARKER';

function makeStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    enhancers: (getDefaultEnhancers) => getDefaultEnhancers({ autoBatch: false }),
  });
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Runs `state` through a real redux-persist `createPersistoid(config)` (the
 * same function `persistReducer` calls internally on every state change)
 * and returns exactly what would have been written to `AsyncStorage` for
 * that config's storage key — or `undefined` if nothing was ever staged
 * for write (which the current fix never triggers, but a hypothetical
 * "blacklist everything" config could).
 */
async function serializeAsThePersistorWould(
  config: PersistConfig<ApiState>,
  state: ApiState,
): Promise<unknown> {
  const setItemMock = AsyncStorage.setItem as jest.Mock;
  setItemMock.mockClear();

  const persistoid = createPersistoid(config);
  persistoid.update(state);
  await persistoid.flush();

  const storageKey = `persist:${config.key}`;
  const call = setItemMock.mock.calls.find(([key]) => key === storageKey);
  if (!call) return undefined;
  return JSON.parse(call[1] as string);
}

describe('api persist config — token leak', () => {
  const fetchMock = jest.fn();
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    store = makeStore();
  });

  afterEach(() => {
    store.dispatch(baseApi.util.resetApiState());
  });

  /**
   * Seeds the store exactly like a real device session: a successful login
   * (mutation, the leak vector) plus a successful production-units fetch
   * (query, what must keep working offline).
   */
  async function seedRealisticState(): Promise<ApiState> {
    fetchMock
      .mockReturnValueOnce(
        okResponse({ data: { accessToken: FAKE_ACCESS_TOKEN, refreshToken: FAKE_REFRESH_TOKEN } }),
      )
      .mockReturnValueOnce(
        okResponse({
          data: [
            {
              id: 1,
              farmId: 7,
              species: 'POULTRY',
              unitKind: 'BATCH',
              breedId: 3,
              name: QUERY_MARKER_UNIT_NAME,
              startDate: '2026-06-01',
              endDate: null,
              currentCount: 480,
              status: 'ACTIVE',
            },
          ],
        }),
      );

    await store.dispatch(authApi.endpoints.login.initiate({ email: 'a@b.c', password: 'x' }));
    await store.dispatch(productionUnitsApi.endpoints.listProductionUnits.initiate(7));

    return store.getState()[baseApi.reducerPath];
  }

  it('sanity check: the login mutation payload really does land in state.api.mutations', async () => {
    const apiState = await seedRealisticState();
    const mutationEntries = Object.values(apiState.mutations);
    const loginEntry = mutationEntries.find(
      (entry) => (entry as { data?: { accessToken?: string } })?.data?.accessToken === FAKE_ACCESS_TOKEN,
    );
    expect(loginEntry).toBeDefined();
  });

  it('the FIXED nested api persist config never writes the tokens to storage, but keeps the query cache', async () => {
    const apiState = await seedRealisticState();

    const written = await serializeAsThePersistorWould(apiPersistConfig, apiState);

    const writtenJson = JSON.stringify(written);
    expect(writtenJson).not.toContain(FAKE_ACCESS_TOKEN);
    expect(writtenJson).not.toContain(FAKE_REFRESH_TOKEN);
    // The `mutations` key itself must be absent, not just its contents scrubbed.
    expect(written).not.toHaveProperty('mutations');

    // The offline-cache requirement (task 8): queries must still be persisted.
    expect(writtenJson).toContain(QUERY_MARKER_UNIT_NAME);
    expect(written).toHaveProperty('queries');
  });

  it('regression trap: a naive config without the mutations blacklist DOES leak the tokens', async () => {
    // Mirrors the pre-fix `persist.ts`, which whitelisted the raw `api`
    // slice at the root with no nested config at all — equivalent, for
    // this slice, to persisting it with no blacklist.
    const naiveConfig: PersistConfig<ApiState> = {
      key: 'api-naive-regression-trap',
      storage: AsyncStorage,
    };

    const apiState = await seedRealisticState();
    const written = await serializeAsThePersistorWould(naiveConfig, apiState);
    const writtenJson = JSON.stringify(written);

    // This is the leak the fix closes — proving this test does distinguish
    // a vulnerable config from the fixed one, rather than only checking a
    // whitelist string.
    expect(writtenJson).toContain(FAKE_ACCESS_TOKEN);
    expect(writtenJson).toContain(FAKE_REFRESH_TOKEN);
  });
});
