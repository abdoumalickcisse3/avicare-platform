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
 * The twin of `vaccination.test.tsx`: the two health field screens were the only ones posting
 * straight to the network. An observation is what a farmer writes down when something looks wrong —
 * the entry most worth not losing in a barn without coverage.
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
import ObservationEntryScreen from '../observation';

describe('ObservationEntryScreen', () => {
  afterEach(() => {
    for (const m of queue.listAll()) queue.markDone(m.id);
  });

  it('enqueues the observation instead of posting it online', async () => {
    await render(<ObservationEntryScreen />);

    await type(screen.getByLabelText('Titre'), "Baisse d'appétit");
    await press(screen.getByLabelText("Enregistrer l'observation"));

    const [entry] = queue.listAll();
    expect(entry).toBeDefined();
    expect(entry?.kind).toBe('HEALTH_OBSERVATION');
    expect(entry?.endpoint).toBe('/api/v1/farms/7/health/observations');
  });

  it('carries the severity the farmer chose, not the default', async () => {
    await render(<ObservationEntryScreen />);

    await press(screen.getByLabelText('Gravité Critique'));
    await type(screen.getByLabelText('Titre'), 'Mortalité en hausse');
    await type(screen.getByLabelText('Description (facultatif)'), 'Trois lots touchés');
    await press(screen.getByLabelText("Enregistrer l'observation"));

    const payload = queue.listAll()[0]?.payload as {
      unitId: number;
      severity: string;
      title: string;
      description: string;
      observationDate: string;
    };
    expect(payload.unitId).toBe(3);
    expect(payload.severity).toBe('CRITICAL');
    expect(payload.title).toBe('Mortalité en hausse');
    expect(payload.description).toBe('Trois lots touchés');
    expect(payload.observationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('refuses to enqueue without a title', async () => {
    await render(<ObservationEntryScreen />);

    await press(screen.getByLabelText('Gravité Vigilance'));
    await press(screen.getByLabelText("Enregistrer l'observation"));

    expect(queue.listAll()).toHaveLength(0);
  });
});
