import { act, fireEvent, render, screen } from '@testing-library/react-native';

// React 19 + RNTL 14: fireEvent schedules a state update that isn't flushed by the time it
// returns, so each gesture is wrapped in an async act — same as the other field screens.
const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

/**
 * Vaccination was the one field screen that posted straight to the network while mortality,
 * weighing, the daily record and the egg collection all went through the offline queue — and the
 * voice assistant already enqueued VACCINATION. A farmer vaccinating in a barn without coverage
 * lost the entry, on the very task the field survey names as the costliest in time.
 *
 * The queue here is the real one (in-memory driver), as in `mortalite.test.tsx`: the assertions
 * exercise the actual enqueue path rather than a mock that could lie about it.
 */

jest.mock('expo-crypto', () => {
  let counter = 0;
  return { randomUUID: jest.fn(() => `uuid-${++counter}`) };
});

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ unitId: '3' })),
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn() })),
  Redirect: () => null,
}));

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));

jest.mock('@/store/api/productionUnitsApi', () => ({
  useListProductionUnitsQuery: jest.fn(() => ({
    data: [
      {
        id: 3,
        farmId: 7,
        currentCount: 480,
        name: 'B-12',
        startDate: '2026-06-01',
        species: 'POULTRY',
      },
    ],
    isLoading: false,
    isError: false,
  })),
}));

jest.mock('@/store/api/healthApi', () => ({
  useGetVaccinesQuery: jest.fn(() => ({
    data: [
      { key: 'newcastle_hb1', name: 'Newcastle HB1' },
      { key: 'gumboro', name: 'Gumboro' },
    ],
    isLoading: false,
  })),
}));

jest.mock('@/sync', () => {
  const { createFakeDriver } = require('@/sync/__tests__/fakeDriver');
  const { createQueue } = require('@/sync/queue');
  const { QUEUE_SCHEMA } = require('@/sync/schema');

  const driver = createFakeDriver();
  driver.exec(QUEUE_SCHEMA);
  const queue = createQueue(driver);

  return {
    queue,
    syncEngine: { drain: jest.fn(() => Promise.resolve({ succeeded: 0, failed: 0 })) },
  };
});

// eslint-disable-next-line import/first
import { queue } from '@/sync';
// eslint-disable-next-line import/first
import VaccinationEntryScreen from '../vaccination';

/**
 * Fills the form with a valid vaccination and submits it. The count field is reached by its label
 * rather than its value: in the app `router.back()` unmounts the screen after a submission, but the
 * mocked router does not, so the field still holds what the previous submission typed.
 */
async function recordVaccination(subjects: string): Promise<void> {
  await press(screen.getByLabelText('Vaccin Newcastle Hb1'));
  await type(screen.getByLabelText('Sujets vaccinés'), subjects);
  await press(screen.getByLabelText('Enregistrer la vaccination'));
}

describe('VaccinationEntryScreen', () => {
  afterEach(() => {
    for (const m of queue.listAll()) queue.markDone(m.id);
  });

  it('enqueues the vaccination instead of posting it online', async () => {
    await render(<VaccinationEntryScreen />);

    await recordVaccination('300');

    const [entry] = queue.listAll();
    expect(entry).toBeDefined();
    expect(entry?.kind).toBe('VACCINATION');
    expect(entry?.endpoint).toBe('/api/v1/farms/7/health/vaccinations');
  });

  it('carries what the farmer entered', async () => {
    await render(<VaccinationEntryScreen />);

    await recordVaccination('300');

    const payload = queue.listAll()[0]?.payload as {
      unitId: number;
      vaccineKey: string;
      subjectsCount: number;
      administeredDate: string;
    };
    expect(payload.unitId).toBe(3);
    expect(payload.vaccineKey).toBe('newcastle_hb1');
    expect(payload.subjectsCount).toBe(300);
    expect(payload.administeredDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('gives each submission its own clientRef', async () => {
    await render(<VaccinationEntryScreen />);

    await recordVaccination('300');
    await recordVaccination('120');

    const refs = queue.listAll().map((m) => m.clientRef);
    expect(refs).toHaveLength(2);
    expect(new Set(refs).size).toBe(2);
  });

  it('refuses to enqueue without a vaccine', async () => {
    await render(<VaccinationEntryScreen />);

    await type(screen.getByLabelText('Sujets vaccinés'), '300');
    await press(screen.getByLabelText('Enregistrer la vaccination'));

    expect(queue.listAll()).toHaveLength(0);
  });

  it('refuses to enqueue a count of zero', async () => {
    await render(<VaccinationEntryScreen />);

    await press(screen.getByLabelText('Vaccin Gumboro'));
    await type(screen.getByLabelText('Sujets vaccinés'), '0');
    await press(screen.getByLabelText('Enregistrer la vaccination'));

    expect(queue.listAll()).toHaveLength(0);
  });
});
