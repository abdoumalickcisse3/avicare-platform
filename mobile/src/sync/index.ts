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
import Constants from 'expo-constants';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '@/auth/tokens';
import { createSqliteDriver } from './driver';
import { createQueue } from './queue';
import { createEngine, type TransportResponse } from './engine';
import { QUEUE_SCHEMA } from './schema';
import type { QueuedMutation } from './types';

const API_URL = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:8080';

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
// Separate from the queue subscribe/notify above on purpose: this fires only
// when `refresh()` (below) gives up on the session and purges tokens, which
// is a completely different concern from "pending/failed counts changed."
// Overloading one Set for both would make `useSyncStatus` re-render on auth
// loss (harmless but noisy) and, worse, couple a future change to one
// concern into accidentally firing the other. The field route guard
// (`app/(field)/_layout.tsx`) is the sole subscriber today: its `useEffect`
// reads the token exactly once on mount, so without this signal a
// background `drain()` that kills the session leaves the guard showing
// `authorized` for a logged-out user.
const authInvalidatedListeners = new Set<() => void>();

export function subscribeAuthInvalidated(listener: () => void): () => void {
  authInvalidatedListeners.add(listener);
  return () => authInvalidatedListeners.delete(listener);
}

function notifyAuthInvalidated(): void {
  for (const listener of authInvalidatedListeners) listener();
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
  const res = await fetch(`${API_URL}${mutation.endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(mutation.payload),
  });
  return { status: res.status, body: await parseBody(res) };
}

type RefreshResponseBody = { data?: { accessToken?: string; refreshToken?: string } };

async function refresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearTokens();
    notifyAuthInvalidated();
    return false;
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      await clearTokens();
      notifyAuthInvalidated();
      return false;
    }
    const body = (await parseBody(res)) as RefreshResponseBody | undefined;
    const accessToken = body?.data?.accessToken;
    const nextRefreshToken = body?.data?.refreshToken;
    if (!accessToken || !nextRefreshToken) {
      await clearTokens();
      notifyAuthInvalidated();
      return false;
    }
    await saveTokens({ accessToken, refreshToken: nextRefreshToken });
    return true;
  } catch {
    // Network failure while refreshing: leave the caller to retry later
    // rather than clearing valid tokens on a transient error.
    return false;
  }
}

// --- engine ---------------------------------------------------------------
const engine = createEngine({ queue: rawQueue, transport, refresh });

export const syncEngine = {
  async drain() {
    syncing = true;
    notify();
    try {
      return await engine.drain();
    } finally {
      syncing = false;
      notify();
    }
  },
};
