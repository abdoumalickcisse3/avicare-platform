import { act, fireEvent, render, screen } from '@testing-library/react-native';

/**
 * Same seams as `mortalite.test.tsx`: `expo-router`, `react-redux` and
 * `@/store/api/productionUnitsApi` are mocked, while `@/sync` is backed by a
 * REAL better-sqlite3 queue so the assertions exercise the actual enqueue path
 * (JSON round-trip of the `individualWeights` list through SQLite), not a mock
 * that could lie about it. See that file for the full rationale on each mock.
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

// The screen only calls useSelector (mocked to return farmId 7), but importing
// `@reduxjs/toolkit/query/react` (for skipToken) runs reactHooksModule at load,
// which asserts all THREE react-redux hooks are present.
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));

jest.mock('@/store/api/productionUnitsApi', () => ({
  useListProductionUnitsQuery: jest.fn(() => ({
    data: [{ id: 3, farmId: 7, currentCount: 480, name: 'B-12', startDate: '2026-06-01', species: 'POULTRY' }],
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
import WeighingEntryScreen from '../pesee';

// React 19 + RNTL 14: fireEvent.press schedules a state update that isn't
// flushed by the time fireEvent returns; wrapping in an async act commits it
// before the next interaction reads the updated state.
const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

/** Types a gram value on the in-screen keypad and pushes it onto the list. */
async function addWeight(grams: number): Promise<void> {
  for (const digit of String(grams)) {
    await press(screen.getByLabelText(`Chiffre ${digit}`));
  }
  await press(screen.getByLabelText('Ajouter la pesée à la liste'));
}

describe('WeighingEntryScreen', () => {
  afterEach(() => {
    for (const m of queue.listAll()) queue.markDone(m.id);
  });

  it('keeps the individual weights intact through the queue round-trip', async () => {
    await render(<WeighingEntryScreen />);

    await addWeight(1850);
    await addWeight(1920);
    await addWeight(1780);

    await press(screen.getByLabelText('Enregistrer la pesée'));

    const [entry] = queue.listAll();
    expect(entry).toBeDefined();
    const payload = entry?.payload as { individualWeights: number[] };
    // Survives JSON.stringify -> SQLite TEXT -> JSON.parse with order and
    // values intact — this is the durability the offline queue promises.
    expect(payload.individualWeights).toEqual([1850, 1920, 1780]);
  });

  it('drops a mistyped weight before it is ever queued', async () => {
    await render(<WeighingEntryScreen />);

    await addWeight(1850);
    await addWeight(999); // fat-fingered
    await addWeight(1920);

    // Remove the bad row from the live list.
    await press(screen.getByLabelText('Supprimer la pesée 999 grammes'));

    await press(screen.getByLabelText('Enregistrer la pesée'));

    const [entry] = queue.listAll();
    const payload = entry?.payload as { individualWeights: number[] };
    expect(payload.individualWeights).toEqual([1850, 1920]);
  });

  it('shows the live average as weights are added', async () => {
    await render(<WeighingEntryScreen />);

    await addWeight(1800);
    await addWeight(2000);

    // (1800 + 2000) / 2 = 1900
    expect(screen.getByText('Moyenne : 1900 g (2 pesées)')).toBeTruthy();
  });

  it('carries the same clientRef in the payload and the queue row', async () => {
    await render(<WeighingEntryScreen />);

    await addWeight(1850);
    await press(screen.getByLabelText('Enregistrer la pesée'));

    const [entry] = queue.listAll();
    const payload = entry?.payload as { clientRef: string };
    expect(payload.clientRef).toBe(entry?.clientRef);
  });
});
