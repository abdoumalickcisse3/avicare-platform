/**
 * Flock helpers — ported from `web/src/lib/flock.ts`. Derives the attrition
 * breakdown (initial / mortality / reform / current / %) for a layer band from
 * its lifecycle events (initial = the CREATED delta).
 */
import type { LifecycleEvent } from '@/store/api/productionUnitsApi';

/**
 * Reconstruct the flock head-count over time from its lifecycle events:
 * accumulate deltas from 0 in chronological order (the CREATED event carries
 * +initialCount, so the first point is initial and the last is current).
 */
export function reconstructFlockCurve(events: LifecycleEvent[]): { date: string; count: number }[] {
  const sorted = [...events].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0));
  let running = 0;
  return sorted.map((e) => {
    running += e.quantityDelta;
    return { date: e.occurredAt.slice(0, 10), count: running };
  });
}

export function summarizeAttrition(events: LifecycleEvent[]): {
  initial: number;
  mortality: number;
  reform: number;
  current: number;
  attritionPct: number;
} {
  let initial = 0;
  let mortality = 0;
  let reform = 0;
  let current = 0;
  for (const e of events) {
    current += e.quantityDelta;
    if (e.eventType === 'CREATED') initial += e.quantityDelta;
    else if (e.eventType === 'MORTALITY') mortality += Math.abs(e.quantityDelta);
    else if (e.eventType === 'REFORM') reform += Math.abs(e.quantityDelta);
  }
  const attritionPct = initial === 0 ? 0 : ((initial - current) / initial) * 100;
  return { initial, mortality, reform, current, attritionPct: Math.round(attritionPct * 10) / 10 };
}
