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

  it('treats a second 401 (after refresh+replay) as retryable, not terminal', async () => {
    const q = setupQueue();
    q.enqueue(mutation);
    let refreshCalls = 0;
    let call = 0;
    const engine = createEngine({
      queue: q,
      // Both the initial attempt and the post-refresh replay come back 401.
      transport: async () => (++call <= 2 ? { status: 401 } : { status: 201 }),
      refresh: async () => {
        refreshCalls += 1;
        return true;
      },
    });

    const result = await engine.drain();

    expect(refreshCalls).toBe(1);
    expect(result.retryable).toBe(1);
    expect(result.failed).toBe(0);
    expect(q.listFailed()).toHaveLength(0);
    expect(q.countPending()).toBe(1);
    expect(q.listAll()[0]?.attempts).toBe(1);

    // The mutation was not parked — it recovers once the server accepts it.
    const recovered = await engine.drain();
    expect(recovered.sent).toBe(1);
    expect(q.countPending()).toBe(0);
  });

  it('parks a double-401 FAILED once the attempt ceiling is reached', async () => {
    const q = setupQueue();
    q.enqueue(mutation);
    const maxAttempts = 2;

    // First pass: a plain 503 bumps attempts 0 -> 1 (still under ceiling).
    const bumpEngine = createEngine({
      queue: q,
      transport: async () => ({ status: 503 }),
      maxAttempts,
    });
    await bumpEngine.drain();
    expect(q.listAll()[0]?.attempts).toBe(1);
    expect(q.listFailed()).toHaveLength(0);

    // Second pass: double-401 with attempts already at maxAttempts - 1, so
    // next.attempts + 1 (== 2) reaches the ceiling of 2 -> terminal FAILED.
    let refreshCalls = 0;
    let call = 0;
    const ceilingEngine = createEngine({
      queue: q,
      transport: async () => (++call <= 2 ? { status: 401 } : { status: 201 }),
      refresh: async () => {
        refreshCalls += 1;
        return true;
      },
      maxAttempts,
    });

    const result = await ceilingEngine.drain();

    expect(refreshCalls).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.retryable).toBe(0);
    expect(q.listFailed()).toHaveLength(1);
    expect(q.listFailed()[0]?.lastError).toBe(`HTTP 401 after ${maxAttempts} attempts`);
  });

  it('resolves drain() with a retryable result when transport throws, and does not wedge', async () => {
    const q = setupQueue();
    q.enqueue(mutation);
    let call = 0;
    const engine = createEngine({
      queue: q,
      transport: async () => {
        call += 1;
        if (call === 1) throw new Error('Network request failed');
        return { status: 201 };
      },
    });

    const result = await engine.drain();

    expect(result.retryable).toBe(1);
    expect(result.failed).toBe(0);
    expect(q.listFailed()).toHaveLength(0);
    expect(q.countPending()).toBe(1);

    // running must have been reset in finally — the same engine instance
    // can still make progress on a later pass, proving it was not wedged.
    const recovered = await engine.drain();
    expect(recovered.sent).toBe(1);
    expect(q.countPending()).toBe(0);
  });
});
