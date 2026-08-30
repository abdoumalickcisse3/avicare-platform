/**
 * The health endpoints' URLs and methods, asserted against a real store.
 *
 * Not a mock of the hook: the stock-movement bug shipped because the screen test mocked the
 * mutation while the endpoint pointed at a route the backend does not serve. These drive the
 * real endpoints through `fetchBaseQuery`, so the path itself is what is being checked.
 */
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../baseApi';
import { healthApi } from '../healthApi';

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

describe('healthApi endpoints', () => {
  let store: ReturnType<typeof makeStore>;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(() => ok({ data: [] }));
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
  const H = `/api/v1/farms/${F}/health`;

  it.each([
    ['getVaccineCatalog', { farmId: F }, `${H}/catalog/vaccines`],
    ['getTreatmentLibrary', { farmId: F }, `${H}/catalog/treatments`],
    ['getProgramCatalog', { farmId: F }, `${H}/catalog/programs`],
    ['getProgramAssignment', { farmId: F, unitId: U }, `${H}/lots/${U}/program`],
    ['getSchedule', { farmId: F, unitId: U }, `${H}/lots/${U}/program/schedule`],
    ['getTreatments', { farmId: F, unitId: U }, `${H}/treatments?unitId=${U}`],
    [
      'getActiveWithdrawals',
      { farmId: F, unitId: U },
      `${H}/treatments/active-withdrawals?unitId=${U}`,
    ],
    ['getVeterinarians', { farmId: F }, `${H}/veterinarians`],
    ['getVetVisits', { farmId: F, unitId: U }, `${H}/vet-visits?unitId=${U}`],
  ])('%s reads %s', async (name, args, expected) => {
    await store.dispatch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (healthApi.endpoints as any)[name].initiate(args),
    );

    expect(lastRequest().url).toContain(expected);
  });

  it('defaults the follow-up window to thirty days, like the server', async () => {
    await store.dispatch(healthApi.endpoints.getUpcomingFollowUps.initiate({ farmId: F }));

    expect(lastRequest().url).toContain(`${H}/vet-visits/upcoming-follow-ups?days=30`);
  });

  it('honours an explicit follow-up window', async () => {
    await store.dispatch(
      healthApi.endpoints.getUpcomingFollowUps.initiate({ farmId: F, days: 7 }),
    );

    expect(lastRequest().url).toContain('days=7');
  });

  it('looks programs up by breed on the dedicated path', async () => {
    await store.dispatch(
      healthApi.endpoints.getProgramsByBreed.initiate({ farmId: F, breedKey: 'cobb_500' }),
    );

    expect(lastRequest().url).toContain(`${H}/catalog/programs/by-breed/cobb_500`);
  });

  it.each([
    ['assignProgram', { farmId: F, unitId: U, programKey: 'chair_std' }, `${H}/lots/${U}/program`, 'POST'],
    ['removeProgram', { farmId: F, unitId: U }, `${H}/lots/${U}/program`, 'DELETE'],
    ['deleteVaccination', { farmId: F, id: 3, unitId: U }, `${H}/vaccinations/3`, 'DELETE'],
    ['deleteObservation', { farmId: F, id: 4, unitId: U }, `${H}/observations/4`, 'DELETE'],
    ['deleteTreatment', { farmId: F, id: 5, unitId: U }, `${H}/treatments/5`, 'DELETE'],
    ['deactivateVeterinarian', { farmId: F, id: 6 }, `${H}/veterinarians/6`, 'DELETE'],
    ['deleteVetVisit', { farmId: F, id: 7, unitId: U }, `${H}/vet-visits/7`, 'DELETE'],
  ])('%s calls %s with %s', async (name, args, expected, method) => {
    fetchMock.mockReturnValueOnce(ok({ data: {} }));

    await store.dispatch(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (healthApi.endpoints as any)[name].initiate(args),
    );

    const request = lastRequest();
    expect(request.url).toContain(expected);
    expect(request.method).toBe(method);
  });

  it('updates a veterinarian with PUT, not POST', async () => {
    fetchMock.mockReturnValueOnce(ok({ data: {} }));

    await store.dispatch(
      healthApi.endpoints.updateVeterinarian.initiate({
        farmId: F,
        id: 6,
        body: { fullName: 'Dr Sow' },
      }),
    );

    // The catalog upserts with POST; the directory does not. Getting this wrong would 405.
    expect(lastRequest().method).toBe('PUT');
    expect(lastRequest().url).toContain(`${H}/veterinarians/6`);
  });

  it('creates a treatment on the collection path', async () => {
    fetchMock.mockReturnValueOnce(ok({ data: {} }));

    await store.dispatch(
      healthApi.endpoints.recordTreatment.initiate({
        farmId: F,
        body: {
          unitId: U,
          treatmentKey: 'amoxicilline_50',
          startDate: '2026-08-30',
          durationDays: 3,
          doseAmount: 1,
          doseUnit: 'g/1000L',
          route: 'drinking_water',
          subjectsCount: 500,
        },
      }),
    );

    const request = lastRequest();
    expect(request.url).toContain(`${H}/treatments`);
    expect(request.method).toBe('POST');
  });
});
