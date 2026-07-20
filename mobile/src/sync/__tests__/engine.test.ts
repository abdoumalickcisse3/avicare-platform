import { createFakeDriver } from './fakeDriver';
import { createQueue } from '../queue';
import { createEngine } from '../engine';
import { QUEUE_SCHEMA } from '../schema';

function setupQueue() {
  const driver = createFakeDriver();
  driver.exec(QUEUE_SCHEMA);
  return createQueue(driver);
}

const mutation = {
  clientRef: 'ref-1',
  farmId: 7,
  kind: 'MORTALITY' as const,
  endpoint: '/api/v1/farms/7/production-units/3/mortality',
  payload: { count: 2, reason: 'field' },
};

describe('sync engine', () => {
  it('removes a mutation after a 2xx', async () => {
    const q = setupQueue();
    q.enqueue(mutation);
    const engine = createEngine({ queue: q, transport: async () => ({ status: 201 }) });
    const result = await engine.drain();
    expect(result.sent).toBe(1);
    expect(q.countPending()).toBe(0);
  });

  it('parks a 422 as terminal and keeps draining', async () => {
    const q = setupQueue();
    q.enqueue({ ...mutation, clientRef: 'a' });
    q.enqueue({ ...mutation, clientRef: 'b' });
    let call = 0;
    const engine = createEngine({
      queue: q,
      transport: async () =>
        ++call === 1 ? { status: 422, body: { detail: 'Effectif insuffisant' } } : { status: 201 },
    });
    const result = await engine.drain();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(1);
    expect(q.listFailed()[0]?.lastError).toBe('Effectif insuffisant');
  });

  it('keeps a 500 retryable and stops the pass', async () => {
    const q = setupQueue();
    q.enqueue(mutation);
    const engine = createEngine({ queue: q, transport: async () => ({ status: 503 }) });
    const result = await engine.drain();
    expect(result.retryable).toBe(1);
    expect(q.countPending()).toBe(1);
    expect(q.listFailed()).toHaveLength(0);
  });

  it('refreshes once on 401 then replays', async () => {
    const q = setupQueue();
    q.enqueue(mutation);
    let refreshed = false;
    let call = 0;
    const engine = createEngine({
      queue: q,
      transport: async () => (++call === 1 ? { status: 401 } : { status: 201 }),
      refresh: async () => {
        refreshed = true;
        return true;
      },
    });
    const result = await engine.drain();
    expect(refreshed).toBe(true);
    expect(result.sent).toBe(1);
  });

  it('gives up after the attempt ceiling', async () => {
    const q = setupQueue();
    q.enqueue(mutation);
    const engine = createEngine({ queue: q, transport: async () => ({ status: 503 }), maxAttempts: 3 });
    await engine.drain();
    await engine.drain();
    await engine.drain();
    expect(q.listFailed()).toHaveLength(1);
  });

  it('sends one mutation at a time, in order', async () => {
    const q = setupQueue();
    q.enqueue({ ...mutation, clientRef: 'a' });
    q.enqueue({ ...mutation, clientRef: 'b' });
    const seen: string[] = [];
    const engine = createEngine({
      queue: q,
      transport: async (m) => {
        seen.push(m.clientRef);
        return { status: 201 };
      },
    });
    await engine.drain();
    expect(seen).toEqual(['a', 'b']);
  });
});
