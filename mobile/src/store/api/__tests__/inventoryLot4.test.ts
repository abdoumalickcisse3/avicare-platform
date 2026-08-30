/**
 * Lot 4's new inventory endpoints, driven through a real store so the path is the assertion.
 */
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../baseApi';
import { inventoryStockApi } from '../inventoryStockApi';
import { inventoryCatalogApi } from '../inventoryCatalogApi';
import { feedFormulasApi } from '../feedFormulasApi';
import { suppliersApi } from '../suppliersApi';

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

describe('inventory endpoints (lot 4)', () => {
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
  const INV = `/api/v1/farms/${F}/inventory`;

  it.each([
    ['getStockItem', 'GET', `${INV}/stock-items/5`, inventoryStockApi, 'getStockItem', { farmId: F, id: 5 }],
    ['getMovementsByItem', 'GET', `${INV}/movements?stockItemId=5`, inventoryStockApi, 'getMovementsByItem', { farmId: F, stockItemId: 5 }],
    ['getMovementsByLot', 'GET', `${INV}/movements/by-lot?unitId=3`, inventoryStockApi, 'getMovementsByLot', { farmId: F, unitId: 3 }],
    ['updateStockThreshold', 'PUT', `${INV}/stock-items/5/threshold`, inventoryStockApi, 'updateStockThreshold', { farmId: F, id: 5, threshold: 50 }],
    ['updateStockNotes', 'PUT', `${INV}/stock-items/5/notes`, inventoryStockApi, 'updateStockNotes', { farmId: F, id: 5, notes: 'x' }],
    ['deactivateStockItem', 'POST', `${INV}/stock-items/5/deactivate`, inventoryStockApi, 'deactivateStockItem', { farmId: F, id: 5 }],
    ['getAllArticles', 'GET', `${INV}/catalog/articles/all`, inventoryCatalogApi, 'getAllArticles', { farmId: F }],
    ['getFeedFormula', 'GET', `${INV}/feed-formulas/3`, feedFormulasApi, 'getFeedFormula', { farmId: F, id: 3 }],
    ['createFeedFormula', 'POST', `${INV}/feed-formulas`, feedFormulasApi, 'createFeedFormula', { farmId: F, body: { name: 'x', targetPhase: 'STARTER', ingredients: [] } }],
    ['updateFeedFormula', 'PUT', `${INV}/feed-formulas/3`, feedFormulasApi, 'updateFeedFormula', { farmId: F, id: 3, body: { name: 'x', targetPhase: 'STARTER', ingredients: [] } }],
    ['getSupplier', 'GET', `${INV}/suppliers/2`, suppliersApi, 'getSupplier', { farmId: F, id: 2 }],
    ['updateSupplier', 'PUT', `${INV}/suppliers/2`, suppliersApi, 'updateSupplier', { farmId: F, id: 2, body: { name: 'x' } }],
    ['deleteSupplier', 'DELETE', `${INV}/suppliers/2`, suppliersApi, 'deleteSupplier', { farmId: F, id: 2 }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ])('%s sends %s to %s', async (_name, expectedMethod, expectedUrl, api: any, endpoint, args) => {
    await store.dispatch(api.endpoints[endpoint].initiate(args));

    const req = lastRequest();
    expect(req.url).toContain(expectedUrl);
    expect(req.method).toBe(expectedMethod);
  });
});
