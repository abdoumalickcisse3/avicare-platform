/**
 * `declareBreed` RTK Query endpoint (task 7, souches-locales-ameliorees): the request body the
 * backend contract requires (`{ name, profile }`, never a `code` or a `species` — see
 * `FarmBreedController`/`DeclareBreedRequest`), and that declaring invalidates the SAME shared
 * cache entry every breed picker in the app subscribes to (`useListBreedsQuery('POULTRY')`) — the
 * mechanism by which a newly declared breed is "found in the selector" without a manual reload.
 *
 * Exercised against a real store + `baseApi.middleware` with `global.fetch` mocked, same pattern
 * as `productionUnitsApi.test.ts`.
 */
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../baseApi';
import { breedsApi, type Breed } from '../breedsApi';

function makeStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    enhancers: (getDefaultEnhancers) => getDefaultEnhancers({ autoBatch: false }),
  });
}

function breed(overrides: Partial<Breed> = {}): Breed {
  return {
    id: 1,
    species: 'POULTRY',
    code: 'cobb_500',
    name: 'Cobb 500',
    type: 'broiler',
    profile: 'BROILER_FAST',
    defaultTargetWeightG: 2300,
    defaultTargetAgeDays: 35,
    farmId: null,
    active: true,
    ...overrides,
  };
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('breedsApi.declareBreed', () => {
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

  it('POSTs only {name, profile} to /api/v1/farms/{farmId}/breeds — never a code or a species', async () => {
    const declared = breed({ id: 9, name: 'Goliath', code: 'goliath', farmId: 7, profile: 'BROILER_RUSTIC' });
    fetchMock.mockReturnValueOnce(okResponse({ data: declared }));

    await store.dispatch(
      breedsApi.endpoints.declareBreed.initiate({
        farmId: 7,
        body: { name: 'Goliath', profile: 'BROILER_RUSTIC' },
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestArg = fetchMock.mock.calls[0]?.[0] as Request;
    expect(requestArg.url).toContain('/api/v1/farms/7/breeds');
    expect(requestArg.method).toBe('POST');
    const sentBody = JSON.parse(await requestArg.clone().text());
    expect(sentBody).toEqual({ name: 'Goliath', profile: 'BROILER_RUSTIC' });
  });

  it('déclare une souche et la retrouve dans le sélecteur — la liste partagée se rafraîchit', async () => {
    fetchMock.mockReturnValueOnce(okResponse({ data: [breed()] }));

    // Mimics any mounted `useListBreedsQuery('POULTRY')` — the batch-creation pickers included.
    const subscription = store.dispatch(breedsApi.endpoints.listBreeds.initiate('POULTRY'));
    await subscription;

    const select = breedsApi.endpoints.listBreeds.select('POULTRY');
    expect(select(store.getState())?.data).toEqual([breed()]);

    const goliath = breed({
      id: 9,
      name: 'Goliath',
      code: 'goliath',
      farmId: 7,
      profile: 'BROILER_RUSTIC',
      defaultTargetWeightG: null,
      defaultTargetAgeDays: null,
    });
    fetchMock.mockReturnValueOnce(okResponse({ data: goliath }));
    fetchMock.mockReturnValueOnce(okResponse({ data: [breed(), goliath] }));

    await store.dispatch(
      breedsApi.endpoints.declareBreed.initiate({
        farmId: 7,
        body: { name: 'Goliath', profile: 'BROILER_RUSTIC' },
      }),
    );
    // The tag invalidation triggers the refetch as a separate dispatched thunk; give it a tick.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(select(store.getState())?.data).toEqual([breed(), goliath]);

    subscription.unsubscribe();
  });
});
