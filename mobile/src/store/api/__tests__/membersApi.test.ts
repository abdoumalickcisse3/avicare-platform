/**
 * Team and farm endpoints — URLs and methods asserted against a real store.
 *
 * Same reasoning as the health slice: a screen test that mocks the hook proves nothing about the
 * path, and a wrong path is exactly the bug that shipped on stock movements.
 */
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../baseApi';
import { membersApi } from '../membersApi';
import { farmsApi } from '../farmsApi';
import { permissionsApi } from '../permissionsApi';

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

describe('team and farm endpoints', () => {
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

  function lastRequest(): { url: string; method: string } {
    const arg = fetchMock.mock.calls[0]?.[0] as string | Request;
    return typeof arg === 'string'
      ? { url: arg, method: 'GET' }
      : { url: arg.url, method: arg.method };
  }

  const F = 7;
  const U = 12;

  it('reads the roster', async () => {
    await store.dispatch(membersApi.endpoints.getMembers.initiate(F));
    expect(lastRequest().url).toContain(`/api/v1/farms/${F}/users`);
  });

  it('reads the permission catalog, which is farm-independent', async () => {
    await store.dispatch(permissionsApi.endpoints.getPermissionCatalog.initiate());
    expect(lastRequest().url).toContain('/api/v1/permissions/catalog');
  });

  it('reads one farm in full', async () => {
    await store.dispatch(farmsApi.endpoints.getFarm.initiate(F));
    expect(lastRequest().url).toContain(`/api/v1/farms/${F}`);
  });

  it.each([
    [
      'createMember',
      'POST',
      `/api/v1/farms/${F}/users`,
      'createMember',
      { farmId: F, body: { fullName: 'Awa', email: 'a@x.io', role: 'FARMER' as const } },
    ],
    [
      'updateMember',
      'PUT',
      `/api/v1/farms/${F}/users/${U}`,
      'updateMember',
      { farmId: F, userId: U, body: { role: 'MANAGER' as const } },
    ],
    [
      'resetMemberPassword',
      'POST',
      `/api/v1/farms/${F}/users/${U}/reset-password`,
      'resetMemberPassword',
      { farmId: F, userId: U },
    ],
    [
      'removeMember',
      'DELETE',
      `/api/v1/farms/${F}/users/${U}`,
      'removeMember',
      { farmId: F, userId: U },
    ],
    ['deleteFarm', 'DELETE', `/api/v1/farms/${F}`, 'deleteFarm', F],
    ['updateFarm', 'PUT', `/api/v1/farms/${F}`, 'updateFarm', { id: F, body: { name: 'Ferme' } }],
  ])('%s sends %s to %s', async (_name, expectedMethod, expectedUrl, endpoint, args) => {
    const api = endpoint === 'deleteFarm' || endpoint === 'updateFarm' ? farmsApi : membersApi;

    await store.dispatch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (api.endpoints as any)[endpoint].initiate(args),
    );

    const req = lastRequest();
    expect(req.url).toContain(expectedUrl);
    expect(req.method).toBe(expectedMethod);
  });
});
