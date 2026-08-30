/** Lot 5's new commercial endpoints — paths asserted against a real store. */
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../baseApi';
import { clientsApi } from '../clientsApi';
import { deliveriesApi } from '../deliveriesApi';
import { paymentsApi } from '../paymentsApi';
import { salesApi } from '../salesApi';
import { invoicesApi } from '../invoicesApi';

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

describe('commercial endpoints (lot 5)', () => {
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
  const C = `/api/v1/farms/${F}/commercial`;

  it.each([
    ['getClient', 'GET', `${C}/clients/3`, clientsApi, 'getClient', { farmId: F, id: 3 }],
    ['getClientCredit', 'GET', `${C}/clients/3/credit`, clientsApi, 'getClientCredit', { farmId: F, id: 3 }],
    ['getClientsOverCreditLimit', 'GET', `${C}/clients/over-credit-limit`, clientsApi, 'getClientsOverCreditLimit', { farmId: F }],
    ['updateClient', 'PUT', `${C}/clients/3`, clientsApi, 'updateClient', { farmId: F, id: 3, body: { clientType: 'INDIVIDUAL', displayName: 'x' } }],
    ['deactivateClient', 'DELETE', `${C}/clients/3`, clientsApi, 'deactivateClient', { farmId: F, id: 3 }],
    ['getDelivery', 'GET', `${C}/deliveries/8`, deliveriesApi, 'getDelivery', { farmId: F, id: 8 }],
    ['cancelDelivery', 'POST', `${C}/deliveries/8/cancel`, deliveriesApi, 'cancelDelivery', { farmId: F, id: 8 }],
    ['getPayments', 'GET', `${C}/payments`, paymentsApi, 'getPayments', { farmId: F }],
    ['voidPayment', 'POST', `${C}/payments/2/void`, paymentsApi, 'voidPayment', { farmId: F, id: 2 }],
    ['getSale', 'GET', `${C}/sales/6`, salesApi, 'getSale', { farmId: F, id: 6 }],
    ['getOverdueInvoices', 'GET', `${C}/invoices/overdue`, invoicesApi, 'getOverdueInvoices', { farmId: F }],
    ['cancelInvoice', 'POST', `${C}/invoices/9/cancel`, invoicesApi, 'cancelInvoice', { farmId: F, id: 9 }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ])('%s sends %s to %s', async (_name, expectedMethod, expectedUrl, api: any, endpoint, args) => {
    await store.dispatch(api.endpoints[endpoint].initiate(args));

    const req = lastRequest();
    expect(req.url).toContain(expectedUrl);
    expect(req.method).toBe(expectedMethod);
  });

  it('filters payments by invoice when asked', async () => {
    await store.dispatch(paymentsApi.endpoints.getPayments.initiate({ farmId: F, invoiceId: 9 }));
    expect(lastRequest().url).toContain(`${C}/payments?invoiceId=9`);
  });
});
