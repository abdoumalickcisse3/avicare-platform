/**
 * Layer (ponte) frontend helpers: human labels for the parametrized time-slots
 * and egg grades, the time-slot pre-selected from the current hour, and a couple
 * of small computations shared by the collection form and the charts.
 */

/** Reference peak laying rate (%) drawn as the target line on the curve. */
export const TARGET_LAYING_RATE_PCT = 90;

/** ISO yyyy-mm-dd for today (local). */
export function isoToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** ISO yyyy-mm-dd for n days before today (local). */
export function isoDaysAgo(n: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const TIMESLOT_LABELS: Record<string, string> = {
  morning: "Matin",
  noon: "Midi",
  evening: "Soir",
};

/** Human label for a time-slot key, falling back to the raw key. */
export function timeslotLabel(key: string): string {
  return TIMESLOT_LABELS[key] ?? key;
}

/** Canonical display order for egg grades; unknown grades sort last, alphabetically. */
const GRADE_ORDER = ["S", "M", "L", "XL"];

export function sortGradeKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = GRADE_ORDER.indexOf(a);
    const ib = GRADE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/**
 * Time-slot pre-selected from the current local hour: before 11h → morning,
 * 11h–15h → noon, after 15h → evening. Generic mapping; if the farm configures
 * custom slots the user can still pick another one in the dialog.
 */
export function defaultTimeslotForNow(slots: string[], now: Date = new Date()): string {
  const h = now.getHours();
  const preferred = h < 11 ? "morning" : h < 15 ? "noon" : "evening";
  if (slots.includes(preferred)) return preferred;
  return slots[0] ?? preferred;
}

/**
 * Layer units of a farm: POULTRY production units that are NOT broiler batches.
 * Broilers are a JOINED subclass exposed via the poultry-batches API, so a plain
 * production unit whose id is not a known batch id is a layer (ponte) unit.
 */
export function selectLayerUnits<T extends { id: number; species: string }>(
  units: T[],
  broilerBatchIds: Set<number>,
): T[] {
  return units.filter(
    (u) => u.species === "POULTRY" && !broilerBatchIds.has(u.id),
  );
}

/** Eggs still to distribute across grades: total − Σ grades (clamped at 0). */
export function remainingToDistribute(
  totalEggs: number,
  gradesCount: Record<string, number>,
): number {
  const assigned = Object.values(gradesCount).reduce(
    (sum, n) => sum + (Number.isFinite(n) ? n : 0),
    0,
  );
  return Math.max(0, totalEggs - assigned);
}
