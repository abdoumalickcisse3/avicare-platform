/** Lot 7's new egg and settings endpoints — paths asserted against a real store. */
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../baseApi';
import { eggProductionApi } from '../eggProductionApi';
import { layerConfigApi } from '../layerConfigApi';

function makeStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    enhancers: (getDefaultEnhancers) => getDefaultEnhancers({ autoBatch: false }),
  });
}

const ok = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

describe('egg and layer-settings endpoints (lot 7)', () => {
  let store: ReturnType<typeof makeStore>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(() => ok({ data: {} }));
    global.fetch = fetchMock as unknown as typeof fetch;
    store = makeStore();
  });

  afterEach(() => {
    store.dispatch(baseApi.util.resetApiState());
  });

  const lastRequest = () => {
    const arg = fetchMock.mock.calls[0]?.[0] as string | Request;
    return typeof arg === 'string' ? { url: arg, method: 'GET' } : { url: arg.url, method: arg.method };
  };

  const F = 7;
  const EGG = `/api/v1/farms/${F}/egg-production`;

  it.each([
    ['updateTrayStock', 'PUT', `${EGG}/tray-stock`, eggProductionApi, 'updateTrayStock', { farmId: F, body: { fullTraysCount: 1, emptyTraysCount: 1 } }],
    ['adjustTrayStock', 'POST', `${EGG}/tray-stock/adjust`, eggProductionApi, 'adjustTrayStock', { farmId: F, body: { fullDelta: 1, emptyDelta: 0 } }],
    ['deleteCollection', 'DELETE', `${EGG}/collections/4`, eggProductionApi, 'deleteCollection', { farmId: F, id: 4, unitId: 2 }],
    ['getGrades', 'GET', `${EGG}/config/grades`, eggProductionApi, 'getGrades', { farmId: F }],
    ['getTraySettings', 'GET', `${EGG}/config/tray-settings`, eggProductionApi, 'getTraySettings', { farmId: F }],
    ['upsertFarmSetting', 'PUT', `/api/v1/farms/${F}/settings/tray_size`, layerConfigApi, 'upsertFarmSetting', { farmId: F, key: 'tray_size', value: '30' }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ])('%s sends %s to %s', async (_name, expectedMethod, expectedUrl, api: any, endpoint, args) => {
    await store.dispatch(api.endpoints[endpoint].initiate(args));

    const req = lastRequest();
    expect(req.url).toContain(expectedUrl);
    expect(req.method).toBe(expectedMethod);
  });
});
