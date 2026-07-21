/**
 * Reusable "enqueue a field mutation" helper, established here for task 10
 * (broiler daily entry) and reused as-is by tasks 11-13 (mortality,
 * weighing, egg collection).
 *
 * Deliberately generic: this module knows nothing about batches, mortality,
 * or any other domain concept — it just stamps a `clientRef`, hands the
 * mutation to the shared queue singleton (`@/sync`), and kicks a drain
 * attempt. Every field screen supplies its own `kind` / `endpoint` /
 * `payload`.
 *
 * No native modules of its own to mock: `expo-crypto`'s `randomUUID` is a
 * thin synchronous wrapper, and `queue`/`syncEngine` are the already-tested
 * singleton from `@/sync`. Covered indirectly by the screen that calls it;
 * see task 7/`sync/index.ts` for why that singleton is never re-created.
 */
import * as Crypto from 'expo-crypto';
import { queue, syncEngine } from '@/sync';
import type { MutationKind } from '@/sync/types';

export type EnqueueFieldMutationInput = {
  farmId: number;
  kind: MutationKind;
  endpoint: string;
  payload: unknown;
  /**
   * Optional override, added in tasks 11-13. Leave unset for an
   * upsert-style mutation (task 10's daily record) where the local queue's
   * uniqueness key is the only thing that matters and a fresh random value
   * is fine.
   *
   * Pass one explicitly when the caller must control the exact value:
   *  - Append events (mortality, weighing — tasks 11/12): the server
   *    dedupes replays on a `client_ref` carried IN THE REQUEST BODY. The
   *    caller generates ONE ref, puts it in `payload.clientRef` AND passes
   *    it here, so the queue row and the payload agree — a replay then
   *    dedupes against the correct event instead of double-counting.
   *  - Deterministic keys (egg collection — task 13): the caller derives a
   *    stable ref from the natural key (unit/date/slot) so re-submitting
   *    the same slot collides with the previous queue row instead of
   *    stacking a duplicate (see the egg screen for the replace-on-collision
   *    logic; this helper stays agnostic to that).
   */
  clientRef?: string;
};

/**
 * Enqueues the mutation and triggers an immediate drain attempt so an
 * online device sends it right away. Offline, the mutation simply stays
 * PENDING until the next trigger (reconnect/foreground, task 7).
 *
 * When `clientRef` isn't supplied, one is generated here (needed for
 * local-queue uniqueness even though most B7 endpoints don't require one
 * server-side — see doc 08 §10). Returns the `clientRef` actually used
 * (generated or passed in) — useful for tests/debugging/optimistic UI; the
 * caller does not need to do anything else with it.
 */
export function enqueueFieldMutation({
  farmId,
  kind,
  endpoint,
  payload,
  clientRef: clientRefOverride,
}: EnqueueFieldMutationInput): string {
  const clientRef = clientRefOverride ?? Crypto.randomUUID();

  queue.enqueue({ clientRef, farmId, kind, endpoint, payload });

  // Fire-and-forget: drain() never rejects (the engine classifies every
  // transport failure internally), but this call site must not produce an
  // unhandled rejection regardless — same defensive pattern as
  // `sync/triggers.ts`.
  syncEngine.drain().catch(() => undefined);

  return clientRef;
}
