import { act, fireEvent, render, screen } from '@testing-library/react-native';

// React 19 + RNTL 14: fireEvent.press / changeText schedule a state update that
// isn't flushed by the time fireEvent returns (concurrent scheduling defers it
// past the synchronous act wrapper). Wrapping in an async act commits it — the
// "Enregistrer" handler reads the `count` state captured at the last render, so
// typing must flush before the press.
const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

const type = (el: Parameters<typeof fireEvent.changeText>[0], text: string): Promise<void> =>
  act(async () => {
    fireEvent.changeText(el, text);
  });

/**
 * The brief's test injects a `queue` prop directly into the screen. The real
 * screen instead reads `unitId`/route params from `expo-router` and reaches
 * the shared `@/sync` queue singleton (same wiring as `journalier.tsx`), so
 * this test mocks those two seams instead of adding a test-only prop to the
 * screen. `@/sync` is backed by a REAL queue (better-sqlite3 in-memory,
 * exactly `sync/__tests__/queue.test.ts`'s driver) rather than a hollow
 * jest.fn() — so the assertions below exercise the actual enqueue path
 * (UNIQUE client_ref, JSON round-trip) instead of asserting against a mock
 * that could lie about it.
 *
 * `expo-crypto`'s jest-expo auto-mock returns `undefined` from every call
 * (see node_modules/expo-crypto/mocks/ExpoCrypto.ts) — useless for a test
 * whose entire point is "two distinct clientRefs" — so `randomUUID` is
 * given a real per-call-incrementing implementation here.
 */

jest.mock('expo-crypto', () => {
  // Declared inside the factory: babel-plugin-jest-hoist forbids a jest.mock
  // factory from closing over an out-of-scope variable that doesn't start
  // with "mock" (the factory is hoisted above regular top-level code). The
  // module is only evaluated once per test file, so this closure still
  // persists across every `it()` in this file, which is exactly what's
  // needed to hand out a fresh id on every call.
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
// which asserts all THREE react-redux hooks are present — so useDispatch/useStore
// must exist as functions even though this screen never invokes them.
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
import MortalityEntryScreen from '../mortalite';

describe('MortalityEntryScreen', () => {
  afterEach(() => {
    for (const m of queue.listAll()) queue.markDone(m.id);
  });

  it('enqueues one mutation per submission, each with its own clientRef', async () => {
    await render(<MortalityEntryScreen />);

    // The count is now tapped in on a counter rather than typed: the gesture changed with
    // the primitives, the contract below did not. The counter resets after each submit, so
    // each distinct event is counted afresh.
    await press(screen.getByLabelText('Ajouter 1'));
    await press(screen.getByLabelText('Ajouter 1'));
    await press(screen.getByLabelText('Enregistrer la mortalité'));

    await press(screen.getByLabelText('Ajouter 1'));
    await press(screen.getByLabelText('Ajouter 1'));
    await press(screen.getByLabelText('Ajouter 1'));
    await press(screen.getByLabelText('Enregistrer la mortalité'));

    const refs = queue.listAll().map((m) => m.clientRef);
    expect(refs).toHaveLength(2);
    expect(new Set(refs).size).toBe(2);
  });

  it('puts the SAME clientRef in the payload and the queue row — the whole point of Task 2', async () => {
    await render(<MortalityEntryScreen />);

    for (let i = 0; i < 5; i += 1) {
      await press(screen.getByLabelText('Ajouter 1'));
    }
    await press(screen.getByLabelText('Enregistrer la mortalité'));

    const [entry] = queue.listAll();
    expect(entry).toBeDefined();
    const payload = entry?.payload as { clientRef: string; count: number };
    expect(payload.clientRef).toBe(entry?.clientRef);
    expect(payload.count).toBe(5);
  });
});
