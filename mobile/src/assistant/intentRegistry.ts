/**
 * Maps a confirmed assistant intent to an offline field mutation. The registry
 * is the ONLY place that knows an intent's endpoint/payload — so the assistant
 * writes go through exactly the same offline queue (idempotent, `client_ref`)
 * as the manual entry screens. No direct API call, no new backend.
 */
import * as Crypto from 'expo-crypto';
import type { EnqueueFieldMutationInput } from '@/field/enqueueMutation';
import type { AssistantIntent } from './types';

/** Build the queue mutation for an intent, or null if it isn't ready (e.g. no
 * lot resolved yet). */
export function toMutation(intent: AssistantIntent, farmId: number): EnqueueFieldMutationInput | null {
  switch (intent.kind) {
    case 'MORTALITY': {
      if (intent.unitId == null) return null;
      // One fresh clientRef, put in the payload AND the queue row — same replay
      // dedup contract as the manual mortality screen.
      const ref = Crypto.randomUUID();
      return {
        farmId,
        kind: 'MORTALITY',
        endpoint: `/api/v1/farms/${farmId}/production-units/${intent.unitId}/mortality`,
        payload: { count: intent.count, reason: intent.reason || undefined, clientRef: ref },
        clientRef: ref,
      };
    }
    default:
      return null;
  }
}
