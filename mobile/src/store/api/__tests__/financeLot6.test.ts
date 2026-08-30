/** Lot 6's new finance endpoints — paths asserted against a real store. */
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../baseApi';
import { financeApi } from '../financeApi';

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

describe('finance endpoints (lot 6)', () => {
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
  const FIN = `/api/v1/farms/${F}/finance`;

  it.each([
    ['updateExpense', 'PUT', `${FIN}/expenses/4`, 'updateExpense', { farmId: F, id: 4, body: { categoryKey: 'feed', label: 'x', amountXof: 1, expenseDate: '2026-08-01' } }],
    ['deleteExpense', 'DELETE', `${FIN}/expenses/4`, 'deleteExpense', { farmId: F, id: 4 }],
    ['getSalarySettings', 'GET', `${FIN}/salary-settings`, 'getSalarySettings', { farmId: F }],
    ['upsertSalarySetting', 'POST', `${FIN}/salary-settings`, 'upsertSalarySetting', { farmId: F, body: { userId: 3, monthlySalaryXof: 90000 } }],
    ['generateSalaries', 'POST', `${FIN}/salaries/generate`, 'generateSalaries', { farmId: F, period: '2026-07' }],
    ['getAdvances', 'GET', `${FIN}/advances`, 'getAdvances', { farmId: F }],
    ['approveAdvance', 'POST', `${FIN}/advances/2/approve`, 'approveAdvance', { farmId: F, id: 2 }],
    ['rejectAdvance', 'POST', `${FIN}/advances/2/reject`, 'rejectAdvance', { farmId: F, id: 2 }],
    ['requestAdvance', 'POST', '/api/v1/my/advances', 'requestAdvance', { body: { farmId: F, amountXof: 10000 } }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ])('%s sends %s to %s', async (_name, expectedMethod, expectedUrl, endpoint, args) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await store.dispatch((financeApi.endpoints as any)[endpoint].initiate(args));

    const req = lastRequest();
    expect(req.url).toContain(expectedUrl);
    expect(req.method).toBe(expectedMethod);
  });

  it('scopes my own advances by farm through a query parameter, not the path', async () => {
    // `/api/v1/my/advances` is not farm-scoped in the path — an easy one to get wrong.
    await store.dispatch(financeApi.endpoints.getMyAdvances.initiate({ farmId: F }));
    expect(lastRequest().url).toContain(`/api/v1/my/advances?farmId=${F}`);
  });

  it('filters advances by status when asked', async () => {
    await store.dispatch(financeApi.endpoints.getAdvances.initiate({ farmId: F, status: 'PENDING' }));
    expect(lastRequest().url).toContain(`${FIN}/advances?status=PENDING`);
  });
});
