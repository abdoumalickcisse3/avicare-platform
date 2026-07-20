import type { createQueue } from './queue';
import type { QueuedMutation } from './types';

export type TransportResponse = { status: number; body?: unknown };

export type Transport = (mutation: QueuedMutation) => Promise<TransportResponse>;

export type DrainResult = { sent: number; failed: number; retryable: number };

export type EngineDeps = {
  queue: ReturnType<typeof createQueue>;
  transport: Transport;
  // Called at most once per drain() pass on a 401. Returns true if the
  // access token was refreshed and the mutation should be replayed once.
  refresh?: () => Promise<boolean>;
  maxAttempts?: number;
};

const MAX_BACKOFF_MS = 5 * 60 * 1000;

// Exponential backoff for the caller's own scheduling (setTimeout between
// drain() passes) — the engine itself does not sleep, it just reports how
// many mutations are retryable so the caller can decide when to call again.
export function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts * 1000, MAX_BACKOFF_MS);
}

function detailOf(response: TransportResponse): string | null {
  const body = response.body;
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
  }
  return null;
}

export function createEngine(deps: EngineDeps) {
  const { queue, transport, refresh, maxAttempts = 8 } = deps;
  let running = false;

  async function drain(): Promise<DrainResult> {
    // Guards against overlapping passes: a network-return listener and an
    // app-foreground listener can both fire in the same instant.
    if (running) return { sent: 0, failed: 0, retryable: 0 };
    running = true;
    const result: DrainResult = { sent: 0, failed: 0, retryable: 0 };
    try {
      let refreshedThisPass = false;
      for (;;) {
        const next = queue.peekNext();
        if (!next) break;

        let response = await transport(next);

        if (response.status === 401 && refresh && !refreshedThisPass) {
          refreshedThisPass = true;
          const ok = await refresh();
          if (!ok) {
            result.retryable += 1;
            break;
          }
          response = await transport(next);
        }

        if (response.status >= 200 && response.status < 300) {
          queue.markDone(next.id);
          result.sent += 1;
          continue;
        }

        if (response.status >= 400 && response.status < 500) {
          // Terminal: a 4xx (other than the 401 handled above) will never
          // succeed on replay. Mark it FAILED and keep draining so it does
          // not block every mutation queued behind it.
          queue.markFailed(next.id, detailOf(response) ?? `HTTP ${response.status}`);
          result.failed += 1;
          continue;
        }

        // 5xx or transport-level failure: retryable. attempts is owned
        // solely by bumpAttempts (markFailed never touches it), so the
        // ceiling check looks at next.attempts + 1 — the value attempts
        // would hold *after* this bump — without actually bumping first.
        if (next.attempts + 1 >= maxAttempts) {
          queue.markFailed(next.id, `HTTP ${response.status} after ${maxAttempts} attempts`);
          result.failed += 1;
        } else {
          queue.bumpAttempts(next.id);
          result.retryable += 1;
        }
        // Stop the pass to preserve order: this mutation stays at the head
        // of the queue (still PENDING, or now FAILED), so we must not skip
        // ahead of it to a later row.
        break;
      }
    } finally {
      running = false;
    }
    return result;
  }

  return { drain };
}
