import { act, fireEvent, render, screen } from '@testing-library/react-native';

/**
 * Same seams as the other field-screen tests (`mortalite`/`pesee`): a REAL
 * better-sqlite3 queue via `@/sync`, mocked router/redux/production-units.
 * Additionally the time-slots come from `layerConfigApi` (doc 00 Règle d'or
 * n°0 — never a hardcoded slot list), mocked here to two configured slots.
 */

jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: jest.fn(() => `uuid-${++counter}`),
  };
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
    data: [{ id: 3, farmId: 7, currentCount: 480, name: 'P-04', startDate: '2026-04-01', species: 'POULTRY' }],
    isLoading: false,
    isError: false,
  })),
}));

jest.mock('@/store/api/layerConfigApi', () => ({
  useListTimeslotsQuery: jest.fn(() => ({
    data: [
      { key: 'morning', value: { label: 'Matin', order: 1 } },
      { key: 'evening', value: { label: 'Soir', order: 3 } },
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
import EggCollectionEntryScreen from '../oeufs';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

const typeTotal = (n: string): Promise<void> => type(screen.getByLabelText("Total d'œufs"), n);

describe('EggCollectionEntryScreen', () => {
  afterEach(() => {
    for (const m of queue.listAll()) queue.markDone(m.id);
  });

  it('replaces the queued draft on a second submission of the same slot (upsert, not stack)', async () => {
    await render(<EggCollectionEntryScreen />);
    // First slot (Matin) is auto-selected once the config loads.

    await typeTotal('12');
    await press(screen.getByLabelText('Enregistrer la collecte'));

    // A correction for the SAME slot before the first ever reached the server.
    await typeTotal('30');
    await press(screen.getByLabelText('Enregistrer la collecte'));

    const rows = queue.listAll();
    expect(rows).toHaveLength(1); // replaced, never stacked
    const payload = rows[0]?.payload as { totalEggs: number; timeslotKey: string };
    expect(payload.totalEggs).toBe(30); // the latest values win
    expect(payload.timeslotKey).toBe('morning');
  });

  it('queues distinct rows for two different slots on the same day', async () => {
    await render(<EggCollectionEntryScreen />);

    await typeTotal('10');
    await press(screen.getByLabelText('Enregistrer la collecte'));

    await press(screen.getByLabelText('Créneau Soir'));
    await press(screen.getByLabelText('Enregistrer la collecte'));

    const slots = queue.listAll().map((m) => (m.payload as { timeslotKey: string }).timeslotKey);
    expect(new Set(slots)).toEqual(new Set(['morning', 'evening']));
  });

  it('derives a deterministic queue key from the natural key (unit, date, slot)', async () => {
    await render(<EggCollectionEntryScreen />);

    await typeTotal('10');
    await press(screen.getByLabelText('Enregistrer la collecte'));

    const [entry] = queue.listAll();
    // No server-side clientRef needed (endpoint upserts on the natural key),
    // but the local queue's identity is stable per slot so a re-submit collides.
    expect(entry?.clientRef).toMatch(/^egg-3-\d{4}-\d{2}-\d{2}-morning$/);
  });
});
