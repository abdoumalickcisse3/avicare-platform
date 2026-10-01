/**
 * The one shared sync stack: SQLite driver -> queue -> engine, plus a real
 * `transport`/`refresh` wired to `fetch` and `expo-secure-store`.
 *
 * This module is a singleton on purpose. `useSyncStatus` (read side) and
 * `triggers.ts` (write side, via `syncEngine.drain()`) must observe and
 * drive the exact same queue/engine pair — two independent `createQueue`
 * instances over the same `avicare.db` file, or two independent engines
 * racing `drain()` against each other, would be a bug (double-sends,
 * inconsistent counts). Everything downstream imports from here, never
 * calls `createQueue`/`createEngine` itself.
 *
 * No unit test: this file only wires already-tested pieces (`queue.ts`,
 * `engine.ts`) to native/global APIs (`expo-sqlite`, `fetch`,
 * `expo-secure-store`) that don't run under Jest. Verified by `tsc --noEmit`
 * and by the app actually bundling/running (see task 7 report).
 */
import { getAccessToken } from '@/auth/tokens';
import { refreshSession } from '@/auth/refreshSession';
import { notifyAuthInvalidated, subscribeAuthInvalidated } from '@/auth/sessionEvents';
import { resolveApiUrl } from '@/config/apiUrl';
import { REQUEST_TIMEOUT_MS } from '@/config/requestTimeout';
import { createSqliteDriver } from './driver';
import { createQueue } from './queue';
import { createEngine, type TransportResponse } from './engine';
import { requestHeaders } from './requestHeaders';
import { QUEUE_SCHEMA } from './schema';
import type { MutationKind, QueuedMutation } from './types';

const API_URL = resolveApiUrl();

// --- subscribe/notify -------------------------------------------------
// countPending()/listFailed() are synchronous DB reads, not reactive on
// their own. Anything that changes what they'd return (enqueue, drain)
// calls notify() so `useSyncStatus` can re-read and re-render.
const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

// --- auth-invalidation signal --------------------------------------------
// The signal itself lives in `@/auth/sessionEvents` (the auth layer raises it without importing this
// singleton); re-exported here because the route guards and the logout purge subscribe through
// `@/sync`. A deliberate logout goes through the same path as a refresh that gave up: both must
// purge the persisted cache and flip the route guard.
export { notifyAuthInvalidated, subscribeAuthInvalidated };

// --- synchronised-writes signal ------------------------------------------
// Kept apart from the two Sets above for the reason stated there: one Set per
// concern. This one fires only when a drain actually landed writes on the
// server, and carries the kinds so the subscriber refreshes the read caches
// those writes made stale — and only those. Before it, a queued entry reached
// the server and stayed off the screen until the RTK Query cache expired: the
// ribbon read "0 en attente" while the list still showed nothing.
const syncedListeners = new Set<(kinds: MutationKind[]) => void>();

export function subscribeSynced(listener: (kinds: MutationKind[]) => void): () => void {
  syncedListeners.add(listener);
  return () => syncedListeners.delete(listener);
}

function notifySynced(kinds: MutationKind[]): void {
  for (const listener of syncedListeners) listener(kinds);
}

let syncing = false;

/** Whether a `drain()` pass is currently in flight. Read by `useSyncStatus`. */
export function isSyncing(): boolean {
  return syncing;
}

// --- queue --------------------------------------------------------------
const driver = createSqliteDriver();
driver.exec(QUEUE_SCHEMA);

const rawQueue = createQueue(driver);

/**
 * The shared queue. Every method delegates straight to `rawQueue` except
 * `enqueue`, which also notifies subscribers — a field screen calling
 * `queue.enqueue(...)` must make `useSyncStatus`'s pending count update.
 */
export const queue: ReturnType<typeof createQueue> = {
  ...rawQueue,
  enqueue(m) {
    rawQueue.enqueue(m);
    notify();
  },
  // The queue screen (`(field)/file`) retries and deletes rows outside a
  // drain, so these must notify too — otherwise the always-visible status
  // ribbon (`useSyncStatus`) would show a stale pending/failed count until
  // the next unrelated notify. The sync engine uses `rawQueue` directly and
  // batches its own notify() at the drain edges, so it is unaffected.
  markPending(id) {
    rawQueue.markPending(id);
    notify();
  },
  markDone(id) {
    rawQueue.markDone(id);
    notify();
  },
};

// --- transport / refresh -------------------------------------------------

// A 204 or empty body must not throw JSON.parse — read as text first and
// only attempt to parse when there is something to parse.
async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function transport(mutation: QueuedMutation): Promise<TransportResponse> {
  const token = await getAccessToken();
  // Without a timeout a hung connection keeps the engine's `running` flag set for as long as the OS
  // lets the socket sit, and every later trigger is ignored: the ribbon spins and nothing syncs.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${mutation.endpoint}`, {
      method: 'POST',
      headers: requestHeaders(mutation, token),
      body: JSON.stringify(mutation.payload),
      signal: controller.signal,
    });
    return { status: res.status, body: await parseBody(res) };
  } finally {
    clearTimeout(timer);
  }
}

// Same single-flight refresh as the screens' queries (see `refreshSession`): a drain and a screen
// answering 401 together must not replay the same single-use refresh token.
async function refresh(): Promise<boolean> {
  return (await refreshSession()) === 'refreshed';
}

// --- engine ---------------------------------------------------------------
const engine = createEngine({ queue: rawQueue, transport, refresh });

export const syncEngine = {
  async drain() {
    syncing = true;
    notify();
    try {
      const result = await engine.drain();
      if (result.sentKinds.length > 0) notifySynced(result.sentKinds);
      return result;
    } finally {
      syncing = false;
      notify();
    }
  },
};

const SIGN_OUT_DRAIN_BUDGET_MS = 8_000;

/**
 * Last chance to send what is queued, then empty the queue — called by a deliberate sign-out only.
 * The queue holds the previous account's writes; left in place, the next person to sign in on a
 * shared phone would replay them under their own session. Entries that still cannot be sent after
 * the budget are dropped rather than carried across accounts.
 */
export async function flushAndPurgeQueue(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SIGN_OUT_DRAIN_BUDGET_MS);
  });
  try {
    await Promise.race([syncEngine.drain().then(() => undefined, () => undefined), budget]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  rawQueue.clearAll();
  notify();
}
