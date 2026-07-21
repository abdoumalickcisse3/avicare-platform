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
};

/**
 * Generates a `clientRef` (needed for local-queue uniqueness even though
 * most B7 endpoints don't require one server-side — see doc 08 §10),
 * enqueues the mutation, and triggers an immediate drain attempt so an
 * online device sends it right away. Offline, the mutation simply stays
 * PENDING until the next trigger (reconnect/foreground, task 7).
 *
 * Returns the generated `clientRef` (useful for tests/debugging/optimistic
 * UI); the caller does not need to do anything else with it.
 */
export function enqueueFieldMutation({ farmId, kind, endpoint, payload }: EnqueueFieldMutationInput): string {
  const clientRef = Crypto.randomUUID();

  queue.enqueue({ clientRef, farmId, kind, endpoint, payload });

  // Fire-and-forget: drain() never rejects (the engine classifies every
  // transport failure internally), but this call site must not produce an
  // unhandled rejection regardless — same defensive pattern as
  // `sync/triggers.ts`.
  syncEngine.drain().catch(() => undefined);

  return clientRef;
}
