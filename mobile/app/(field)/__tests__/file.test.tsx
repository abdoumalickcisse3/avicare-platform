import { Alert } from 'react-native';
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

// Le préfixe `mock` est la seule façon pour une fabrique jest.mock() de voir une variable
// extérieure (garde-fou de Babel contre les mocks non initialisés).
const mockRecordMovement = jest.fn(() => ({ unwrap: () => Promise.resolve({}) }));
jest.mock('@/store/api/inventoryStockApi', () => ({
  useRecordMovementMutation: () => [mockRecordMovement, { isLoading: false }],
}));

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

  it('delete asks for confirmation and only then removes the failed mutation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const id = enqueueMortality('ref-1');
    queue.markFailed(id, 'Requête invalide');

    await render(<QueueScreen />);
    await press(screen.getByLabelText('Supprimer'));

    // Nothing is lost by the tap alone.
    expect(queue.listAll()).toHaveLength(1);
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    const confirm = buttons.find((b) => b.style === 'destructive');
    await act(async () => {
      confirm?.onPress?.();
    });

    expect(queue.listAll()).toHaveLength(0);
    alert.mockRestore();
  });

  it('keeps the mutation when the deletion is cancelled', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const id = enqueueMortality('ref-1');
    queue.markFailed(id, 'Requête invalide');

    await render(<QueueScreen />);
    await press(screen.getByLabelText('Supprimer'));
    const cancel = (alert.mock.calls[0]?.[2] ?? []).find((b) => b.style === 'cancel');
    await act(async () => {
      cancel?.onPress?.();
    });

    expect(queue.listAll()).toHaveLength(1);
    alert.mockRestore();
  });

  it('lists pending mutations and reflects an empty queue', async () => {
    await render(<QueueScreen />);
    expect(screen.getByText(/tout est synchronisé/i)).toBeTruthy();
  });

  const SHORTAGE = {
    code: 'STOCK_INSUFFICIENT',
    properties: {
      stockItemId: 9,
      articleLabel: 'Aliment démarrage',
      unit: 'sac',
      available: -2,
      requested: 3,
    },
  };

  it('propose de corriger le stock quand le refus est réparable', async () => {
    const id = enqueueMortality('ref-1');
    queue.markFailed(id, 'Stock insuffisant : il reste -2 sac de Aliment démarrage.', SHORTAGE);

    await render(<QueueScreen />);

    expect(screen.getByLabelText('Corriger le stock')).toBeTruthy();
  });

  it('ne le propose pas sur un refus ordinaire — il n’y aurait rien à corriger', async () => {
    const id = enqueueMortality('ref-1');
    queue.markFailed(id, 'Le module Inventaire est inactif');

    await render(<QueueScreen />);

    expect(screen.queryByLabelText('Corriger le stock')).toBeNull();
  });

  it('entre la quantité manquante, pas la quantité demandée', async () => {
    // Sur une ligne à −2 qui doit en sortir 3, entrer 3 laisserait le solde à −2 et la saisie
    // serait refusée une seconde fois.
    const id = enqueueMortality('ref-1');
    queue.markFailed(id, 'Stock insuffisant', SHORTAGE);

    await render(<QueueScreen />);
    await press(screen.getByLabelText('Corriger le stock'));
    await press(screen.getByLabelText("Je l'ai reçu, l'achat n'a pas été saisi"));
    await press(screen.getByLabelText('Enregistrer la correction'));

    expect(mockRecordMovement).toHaveBeenCalledWith({
      farmId: 7,
      body: { stockItemId: 9, movementType: 'IN', quantity: 5, reason: 'RECEPTION_PURCHASE' },
    });
  });

  it('remet la saisie en file une fois le stock corrigé', async () => {
    const id = enqueueMortality('ref-1');
    queue.markFailed(id, 'Stock insuffisant', SHORTAGE);

    await render(<QueueScreen />);
    await press(screen.getByLabelText('Corriger le stock'));
    await press(screen.getByLabelText("Je l'ai reçu, l'achat n'a pas été saisi"));
    await press(screen.getByLabelText('Enregistrer la correction'));

    // Le geste entier : corriger le stock ET relancer la saisie. S'arrêter au mouvement
    // laisserait l'éleveur devant la même ligne rouge, à deviner qu'il doit réessayer.
    expect(queue.listFailed()).toHaveLength(0);
    expect(queue.countPending()).toBe(1);
    expect(syncEngine.drain).toHaveBeenCalled();
  });

  it('part du comptage à vide quand on choisit l’inventaire', async () => {
    const id = enqueueMortality('ref-1');
    queue.markFailed(id, 'Stock insuffisant', SHORTAGE);

    await render(<QueueScreen />);
    await press(screen.getByLabelText('Corriger le stock'));
    await press(screen.getByLabelText("Je compte ce qu'il y a dans le magasin"));

    // Rien de pré-rempli : tout l'intérêt de ce geste est que quelqu'un compte.
    expect(screen.getByLabelText('Quantité saisie')).toHaveTextContent('0 sac');
    await press(screen.getByLabelText('4'));
    await press(screen.getByLabelText('Enregistrer la correction'));

    expect(mockRecordMovement).toHaveBeenCalledWith({
      farmId: 7,
      body: { stockItemId: 9, movementType: 'ADJUSTMENT', quantity: 4, reason: 'INVENTORY_PHYSICAL' },
    });
  });

});
