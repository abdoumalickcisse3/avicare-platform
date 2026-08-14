/**
 * Converts the backend `/assistant/interpret` DRAFT response into a local
 * `AssistantIntent`. The backend does the extraction; the mobile then builds
 * the confirmation card uniformly (see `drafts.buildConfirmation`) — so the LLM
 * path and the rules path render identically.
 */
import type { InterpretResponse } from '@/store/api/assistantApi';
import type { AssistantIntent } from '../types';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function numOrU(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function strOrU(v: unknown): string | undefined {
  const s = v == null ? '' : String(v).trim();
  return s ? s : undefined;
}

export function intentFromInterpret(resp: InterpretResponse): AssistantIntent | null {
  if (resp.kind !== 'DRAFT' || !resp.action) return null;
  const f = resp.fields ?? {};
  const unitId = (resp.unitId ?? (f.unitId as number | undefined)) ?? null;

  switch (resp.action) {
    case 'MORTALITY':
      return { kind: 'MORTALITY', count: num(f.count), reason: strOrU(f.reason), unitId };
    case 'DAILY_RECORD':
      return {
        kind: 'DAILY_RECORD',
        mortalityCount: num(f.mortalityCount),
        feedKg: numOrU(f.feedKg),
        waterL: numOrU(f.waterL),
        observations: strOrU(f.observations),
        unitId,
      };
    case 'WEIGHING':
      return { kind: 'WEIGHING', weights: Array.isArray(f.weights) ? (f.weights as number[]) : [], notes: strOrU(f.notes), unitId };
    case 'EGG_COLLECTION':
      return {
        kind: 'EGG_COLLECTION',
        totalEggs: num(f.totalEggs),
        brokenEggs: numOrU(f.brokenEggs),
        timeslotKey: String(f.timeslotKey ?? ''),
        unitId,
      };
    case 'VACCINATION':
      return {
        kind: 'VACCINATION',
        vaccineKey: String(f.vaccineKey ?? ''),
        vaccineLabel: String(f.vaccineLabel ?? f.vaccineKey ?? ''),
        subjectsCount: num(f.subjectsCount),
        unitId,
      };
    case 'HEALTH_OBSERVATION':
      return {
        kind: 'HEALTH_OBSERVATION',
        title: String(f.title ?? ''),
        description: strOrU(f.description),
        severity: strOrU(f.severity),
        suspectedDisease: strOrU(f.suspectedDisease),
        unitId,
      };
    case 'CREATE_CLIENT':
      return {
        kind: 'CREATE_CLIENT',
        displayName: String(f.displayName ?? ''),
        clientType: String(f.clientType ?? 'INDIVIDUAL'),
      };
    case 'ADJUST_STOCK':
      return {
        kind: 'ADJUST_STOCK',
        stockItemId: num(f.stockItemId),
        articleKey: String(f.articleKey ?? ''),
        delta: num(f.delta),
        unit: strOrU(f.unit),
        before: numOrU(f.before),
        after: numOrU(f.after),
      };
    default:
      return null;
  }
}
