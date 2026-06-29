import type { DailyProduction, EggCollection, LifecycleEvent } from "@/types";

/** ISO datetime → "YYYY-MM-DD" (date part only). */
function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Reconstruct the flock head-count over time from its lifecycle events.
 * Accumulates deltas from 0 in chronological order; the CREATED event carries
 * +initialCount, so the first point is the initial count and the last is current.
 */
export function reconstructFlockCurve(
  events: LifecycleEvent[],
): { date: string; count: number }[] {
  const sorted = [...events].sort((a, b) =>
    a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0,
  );
  let running = 0;
  return sorted.map((e) => {
    running += e.quantityDelta;
    return { date: dayOf(e.occurredAt), count: running };
  });
}

/** Attrition breakdown derived from the events (initial = CREATED delta). */
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
    if (e.eventType === "CREATED") initial += e.quantityDelta;
    else if (e.eventType === "MORTALITY") mortality += Math.abs(e.quantityDelta);
    else if (e.eventType === "REFORM") reform += Math.abs(e.quantityDelta);
  }
  const attritionPct =
    initial === 0 ? 0 : ((initial - current) / initial) * 100;
  return {
    initial,
    mortality,
    reform,
    current,
    // round to 1 decimal to avoid float noise (1.2999999…)
    attritionPct: Math.round(attritionPct * 10) / 10,
  };
}

/**
 * Onset of lay = earliest closed daily production with eggs > 0; falls back to
 * the earliest collection with eggs > 0; null if nothing has laid yet.
 */
export function deriveLayingOnset(
  productions: DailyProduction[],
  collections: EggCollection[],
): string | null {
  const fromProductions = productions
    .filter((p) => (p.totalEggsCollected ?? 0) > 0)
    .map((p) => p.productionDate)
    .sort();
  if (fromProductions.length > 0) return fromProductions[0];

  const fromCollections = collections
    .filter((c) => (c.totalEggs ?? 0) > 0)
    .map((c) => c.collectionDate)
    .sort();
  return fromCollections.length > 0 ? fromCollections[0] : null;
}
