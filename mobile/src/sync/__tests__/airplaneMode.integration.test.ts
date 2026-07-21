import { createFakeDriver } from './fakeDriver';
import { createQueue } from '../queue';
import { createEngine, type Transport, type TransportResponse } from '../engine';
import { QUEUE_SCHEMA } from '../schema';
import { accumulateDaily, type DailyDraft } from '../../field/dailyAccumulator';
import type { SqlDriver } from '../types';

/**
 * Automated stand-in for the B7 "mode avion" acceptance recipe
 * (`docs/superpowers/plans/2026-07-20-b7-acceptance-log.md`), steps 3–8.
 *
 * It drives the REAL sync core — `createQueue` on an in-memory SQLite driver
 * and `createEngine` — through a controllable transport that flips between
 * "airplane mode" (fetch rejects) and "online" (200), so the mechanical
 * invariants the recipe checks by hand are enforced in CI:
 *   - 5 mortalities on a chair lot = ONE upsert row, not five (step 3)
 *   - a weighing + an egg collection bring the queue to three (step 4)
 *   - the queue survives a process restart (step 5, SQLite durability)
 *   - reconnecting drains it exactly once each (step 6)
 *   - a network cut mid-drain replays the SAME client_ref, so the server
 *     dedups instead of double-counting (step 8)
 *
 * What it deliberately does NOT replace: the true device-level steps a
 * harness cannot reproduce — a real airplane-mode toggle, a real app
 * kill/restart, and the cross-check against the web app (steps 1–2, 5's real
 * kill, 7). Those stay manual in the acceptance log.
 */

/** A transport whose connectivity and per-mutation failures the test controls. */
function controllableTransport() {
  const sent: { clientRef: string; payload: unknown }[] = [];
  let online = false;
  // clientRef -> number of leading attempts that should fail with a 5xx
  // before the mutation is allowed to succeed (simulates a mid-drain cut).
  const failFirst = new Map<string, number>();

  const transport: Transport = async (mutation): Promise<TransportResponse> => {
    if (!online) {
      // Airplane mode: fetch rejects. The engine must classify this itself.
      throw new Error('Network request failed');
    }
    const remaining = failFirst.get(mutation.clientRef) ?? 0;
    if (remaining > 0) {
      failFirst.set(mutation.clientRef, remaining - 1);
      return { status: 503, body: { detail: 'Service momentanément indisponible' } };
    }
    // The server dedups on the client_ref carried in the body; record what
    // it received so the test can prove no duplicate ever double-counts.
    sent.push({ clientRef: mutation.clientRef, payload: mutation.payload });
    return { status: 200, body: {} };
  };

  return {
    transport,
    sent,
    goOnline: () => {
      online = true;
    },
    goOffline: () => {
      online = false;
    },
    failNextAttempts: (clientRef: string, count: number) => failFirst.set(clientRef, count),
  };
}

function freshQueue(driver: SqlDriver) {
  return createQueue(driver);
}

describe('airplane-mode recipe (automated, steps 3-8)', () => {
  it('queues offline, survives a restart, and drains once each on reconnect', async () => {
    const driver = createFakeDriver();
    driver.exec(QUEUE_SCHEMA);
    const queue = freshQueue(driver);
    const net = controllableTransport();
    const engine = createEngine({ queue, transport: net.transport });

    // --- Step 3: five "+1 mort" taps on a chair lot -> ONE daily upsert ---
    let draft: DailyDraft | null = null;
    for (let i = 0; i < 5; i += 1) {
      draft = accumulateDaily(draft, { mortalityCount: 1 });
    }
    expect(draft?.mortalityCount).toBe(5);
    queue.enqueue({
      clientRef: 'daily-1',
      farmId: 7,
      kind: 'DAILY_RECORD',
      endpoint: '/api/v1/farms/7/poultry-batches/3/daily-records',
      payload: { recordDate: '2026-07-21', mortalityCount: draft!.mortalityCount, feedKg: 0, waterL: 0 },
    });
    // One row for five taps — the whole point of the local running total.
    expect(queue.listAll()).toHaveLength(1);

    // --- Step 4: a weighing and an egg collection -> three actions ---
    queue.enqueue({
      clientRef: 'weigh-1',
      farmId: 7,
      kind: 'WEIGHING',
      endpoint: '/api/v1/farms/7/poultry-batches/3/weighings',
      payload: { sampleDate: '2026-07-21', individualWeights: [1850, 1920], clientRef: 'weigh-1' },
    });
    queue.enqueue({
      clientRef: 'egg-3-2026-07-21-morning',
      farmId: 7,
      kind: 'EGG_COLLECTION',
      endpoint: '/api/v1/farms/7/egg-production/collections',
      payload: { unitId: 3, collectionDate: '2026-07-21', timeslotKey: 'morning', totalEggs: 240, brokenEggs: 3 },
    });
    expect(queue.listAll()).toHaveLength(3);

    // --- Still offline: a drain attempt sends nothing, nothing is lost ---
    const offlineResult = await engine.drain();
    expect(offlineResult.sent).toBe(0);
    expect(net.sent).toHaveLength(0);
    expect(queue.countPending()).toBe(3);

    // --- Step 5: process restart -> a NEW queue on the SAME database ---
    // The three rows must still be there (SQLite durability), which is what
    // the manual recipe proves by killing and relaunching the app.
    const queueAfterRestart = freshQueue(driver);
    expect(queueAfterRestart.listAll()).toHaveLength(3);

    // --- Step 6: reconnect -> the queue drains itself, once each ---
    net.goOnline();
    const engineAfterRestart = createEngine({ queue: queueAfterRestart, transport: net.transport });
    const onlineResult = await engineAfterRestart.drain();

    expect(onlineResult.sent).toBe(3);
    expect(queueAfterRestart.listAll()).toHaveLength(0);
    const refs = net.sent.map((r) => r.clientRef);
    expect(new Set(refs)).toEqual(new Set(['daily-1', 'weigh-1', 'egg-3-2026-07-21-morning']));
  });

  it('replays the SAME client_ref after a mid-drain cut, so the server never double-counts (step 8)', async () => {
    const driver = createFakeDriver();
    driver.exec(QUEUE_SCHEMA);
    const queue = freshQueue(driver);
    const net = controllableTransport();
    const engine = createEngine({ queue, transport: net.transport });

    // An append event (layer mortality) — the case the client_ref key exists
    // to protect. The network drops on the first attempt mid-drain.
    queue.enqueue({
      clientRef: 'mort-42',
      farmId: 7,
      kind: 'MORTALITY',
      endpoint: '/api/v1/farms/7/production-units/3/mortality',
      payload: { count: 2, clientRef: 'mort-42' },
    });
    net.goOnline();
    net.failNextAttempts('mort-42', 1); // one 5xx, then it succeeds

    const first = await engine.drain(); // 5xx -> retryable, stays PENDING
    expect(first.sent).toBe(0);
    expect(first.retryable).toBe(1);
    expect(queue.countPending()).toBe(1);

    const second = await engine.drain(); // now 200 -> done
    expect(second.sent).toBe(1);
    expect(queue.listAll()).toHaveLength(0);

    // The server only saw ONE successful write, and both times the request
    // carried the identical client_ref — so even if the failed first attempt
    // had actually reached the server, its dedup would collapse the two into
    // one. No fresh ref is ever minted on retry.
    expect(net.sent).toHaveLength(1);
    expect(net.sent[0]?.clientRef).toBe('mort-42');
    expect((net.sent[0]?.payload as { clientRef: string }).clientRef).toBe('mort-42');
  });
});
