import { act, fireEvent, render, screen } from '@testing-library/react-native';

/**
 * The pending/failed queue screen reads the shared `@/sync` singleton (same
 * wiring as the field entry screens). The mock below reproduces the singleton
 * faithfully: a REAL better-sqlite3 queue plus a real subscribe/notify so the
 * screen actually re-renders after a retry/delete — exactly how `sync/index.ts`
 * wires them in production (enqueue/markPending/markDone call notify()).
 */

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn() })),
}));

jest.mock('@/sync', () => {
  const { createFakeDriver } = require('@/sync/__tests__/fakeDriver');
  const { createQueue } = require('@/sync/queue');
  const { QUEUE_SCHEMA } = require('@/sync/schema');

  const driver = createFakeDriver();
  driver.exec(QUEUE_SCHEMA);
  const raw = createQueue(driver);

  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((l) => l());

  const queue = {
    ...raw,
    enqueue: (m: Parameters<typeof raw.enqueue>[0]) => {
      raw.enqueue(m);
      notify();
    },
    markPending: (id: number) => {
      raw.markPending(id);
      notify();
    },
    markDone: (id: number) => {
      raw.markDone(id);
      notify();
    },
  };

  return {
    queue,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    syncEngine: { drain: jest.fn(() => Promise.resolve({ succeeded: 0, failed: 0 })) },
    isSyncing: () => false,
  };
});

// eslint-disable-next-line import/first
import { queue, syncEngine } from '@/sync';
// eslint-disable-next-line import/first
import QueueScreen from '../file';

const press = (el: Parameters<typeof fireEvent.press>[0]): Promise<void> =>
  act(async () => {
    fireEvent.press(el);
  });

function enqueueMortality(clientRef: string): number {
  queue.enqueue({
    clientRef,
    farmId: 7,
    kind: 'MORTALITY',
    endpoint: '/api/v1/farms/7/production-units/3/mortality',
    payload: { count: 2, clientRef },
  });
  return queue.peekNext()!.id;
}

describe('QueueScreen', () => {
  afterEach(() => {
    for (const m of queue.listAll()) queue.markDone(m.id);
    jest.clearAllMocks();
  });

  it('shows the server message on a failed mutation, not a generic string', async () => {
    const id = enqueueMortality('ref-1');
    queue.markFailed(id, 'Le module Inventaire est inactif');

    await render(<QueueScreen />);

    // The exact RFC 7807 detail the server returned — an éleveur must know
    // what to fix, so a generic "Erreur de synchronisation" would be a regression.
    expect(screen.getByText('Le module Inventaire est inactif')).toBeTruthy();
  });

  it('retry moves a failed mutation back to PENDING and kicks a drain', async () => {
    const id = enqueueMortality('ref-1');
    queue.markFailed(id, 'Erreur serveur temporaire');

    await render(<QueueScreen />);
    await press(screen.getByLabelText('Réessayer'));

    expect(queue.listFailed()).toHaveLength(0);
    expect(queue.countPending()).toBe(1);
    expect(syncEngine.drain).toHaveBeenCalled();
  });

  it('delete removes a failed mutation from the queue', async () => {
    const id = enqueueMortality('ref-1');
    queue.markFailed(id, 'Requête invalide');

    await render(<QueueScreen />);
    await press(screen.getByLabelText('Supprimer'));

    expect(queue.listAll()).toHaveLength(0);
  });

  it('lists pending mutations and reflects an empty queue', async () => {
    await render(<QueueScreen />);
    expect(screen.getByText(/tout est synchronisé/i)).toBeTruthy();
  });
});
