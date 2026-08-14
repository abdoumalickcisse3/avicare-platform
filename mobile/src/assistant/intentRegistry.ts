/**
 * Maps a confirmed assistant intent to an offline field mutation. The registry
 * is the ONLY place that knows an intent's endpoint/payload — so the assistant
 * writes go through exactly the same offline queue (idempotent, `client_ref`)
 * as the manual entry screens. No direct API call, no new backend.
 */
import * as Crypto from 'expo-crypto';
import type { EnqueueFieldMutationInput } from '@/field/enqueueMutation';
import type { AssistantIntent } from './types';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Build the queue mutation for an intent, or null if it isn't ready (e.g. no
 * lot resolved yet). */
export function toMutation(intent: AssistantIntent, farmId: number): EnqueueFieldMutationInput | null {
  // Lot-less actions are handled before the lot guard.
  if (intent.kind === 'CREATE_CLIENT') {
    return {
      farmId,
      kind: 'CREATE_CLIENT',
      endpoint: `/api/v1/farms/${farmId}/commercial/clients`,
      payload: { clientType: intent.clientType, displayName: intent.displayName },
    };
  }

  if (intent.unitId == null) return null;
  const unitId = intent.unitId;

  switch (intent.kind) {
    case 'MORTALITY': {
      // Fresh clientRef in the payload AND the queue row — server replay dedup.
      const ref = Crypto.randomUUID();
      return {
        farmId,
        kind: 'MORTALITY',
        endpoint: `/api/v1/farms/${farmId}/production-units/${unitId}/mortality`,
        payload: { count: intent.count, reason: intent.reason || undefined, clientRef: ref },
        clientRef: ref,
      };
    }
    case 'DAILY_RECORD':
      return {
        farmId,
        kind: 'DAILY_RECORD',
        endpoint: `/api/v1/farms/${farmId}/poultry-batches/${unitId}/daily-records`,
        payload: {
          recordDate: todayIso(),
          mortalityCount: intent.mortalityCount,
          feedKg: intent.feedKg,
          waterL: intent.waterL,
          observations: intent.observations || undefined,
        },
      };
    case 'WEIGHING': {
      const ref = Crypto.randomUUID();
      return {
        farmId,
        kind: 'WEIGHING',
        endpoint: `/api/v1/farms/${farmId}/poultry-batches/${unitId}/weighings`,
        payload: { sampleDate: todayIso(), individualWeights: intent.weights, notes: intent.notes || undefined, clientRef: ref },
        clientRef: ref,
      };
    }
    case 'EGG_COLLECTION': {
      const date = todayIso();
      // Deterministic per (unit, date, slot) — resubmitting the same slot
      // replaces instead of stacking (same contract as the manual screen).
      const ref = `egg-${unitId}-${date}-${intent.timeslotKey}`;
      return {
        farmId,
        kind: 'EGG_COLLECTION',
        endpoint: `/api/v1/farms/${farmId}/egg-production/collections`,
        payload: {
          unitId,
          collectionDate: date,
          timeslotKey: intent.timeslotKey,
          totalEggs: intent.totalEggs,
          brokenEggs: intent.brokenEggs ?? 0,
        },
        clientRef: ref,
      };
    }
    case 'VACCINATION':
      // Health endpoints don't dedup server-side (no client_ref in the body);
      // the queue stamps one only for local uniqueness (like the daily record).
      return {
        farmId,
        kind: 'VACCINATION',
        endpoint: `/api/v1/farms/${farmId}/health/vaccinations`,
        payload: {
          unitId,
          vaccineKey: intent.vaccineKey,
          administeredDate: todayIso(),
          subjectsCount: intent.subjectsCount,
        },
      };
    case 'HEALTH_OBSERVATION':
      return {
        farmId,
        kind: 'HEALTH_OBSERVATION',
        endpoint: `/api/v1/farms/${farmId}/health/observations`,
        payload: {
          unitId,
          observationDate: todayIso(),
          title: intent.title,
          description: intent.description || undefined,
          severity: intent.severity || undefined,
          suspectedDisease: intent.suspectedDisease || undefined,
        },
      };
    default:
      return null;
  }
}
