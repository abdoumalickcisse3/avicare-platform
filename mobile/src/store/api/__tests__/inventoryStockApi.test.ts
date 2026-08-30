/**
 * `recordMovement` — the URL, asserted against a real store.
 *
 * The screen test for `StockMovementSheet` mocks the mutation hook, so it stayed green while the
 * endpoint posted to a path the backend does not serve (`/inventory/stock-items/movements`) and
 * every stock movement recorded from the app failed. A mock of the wrong path is still a mock.
 * This test drives the real endpoint through `fetchBaseQuery`, so the path itself is the assertion.
 */
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../baseApi';
import { inventoryStockApi } from '../inventoryStockApi';

function makeStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
    enhancers: (getDefaultEnhancers) => getDefaultEnhancers({ autoBatch: false }),
  });
}

function okResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('inventoryStockApi.recordMovement', () => {
  let store: ReturnType<typeof makeStore>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    store = makeStore();
  });

  afterEach(() => {
    store.dispatch(baseApi.util.resetApiState());
  });

  function calledUrl(): string {
    // fetchBaseQuery calls fetch(new Request(url, init)) under Node's native fetch.
    const arg = fetchMock.mock.calls[0]?.[0] as string | Request;
    return typeof arg === 'string' ? arg : arg.url;
  }

  it('posts to /inventory/movements, the path the backend actually serves', async () => {
    fetchMock.mockReturnValueOnce(okResponse({ data: {} }));

    await store.dispatch(
      inventoryStockApi.endpoints.recordMovement.initiate({
        farmId: 7,
        body: {
          articleKey: 'mais',
          movementType: 'IN',
          quantity: 10,
        } as never,
      }),
    );

    expect(calledUrl()).toContain('/api/v1/farms/7/inventory/movements');
    // The route that does not exist, and that this endpoint used to call.
    expect(calledUrl()).not.toContain('/stock-items/movements');
  });

  it('agrees with the offline queue, which had the path right all along', async () => {
    fetchMock.mockReturnValueOnce(okResponse({ data: {} }));

    await store.dispatch(
      inventoryStockApi.endpoints.recordMovement.initiate({
        farmId: 7,
        body: { articleKey: 'mais', movementType: 'OUT', quantity: 1 } as never,
      }),
    );

    // `assistant/intentRegistry.ts` enqueues STOCK_ADJUSTMENT to this same path, which is why
    // voice-dictated adjustments worked while the manual sheet did not.
    expect(calledUrl().endsWith('/api/v1/farms/7/inventory/movements')).toBe(true);
  });
});
