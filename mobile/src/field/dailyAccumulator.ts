/**
 * Local running total for the broiler daily-entry screen (task 10).
 *
 * The trap this exists to handle (doc 08 §10): the daily-records endpoint is
 * an UPSERT per (batch, date). Five taps of "+1 mort" are NOT five server
 * additions — a naive implementation that fired one request per tap would
 * silently overwrite itself four times and lose four deaths. The mobile app
 * therefore keeps this local draft for the day and pushes the TOTAL exactly
 * once, on "Valider".
 *
 * The two fields behave differently on purpose, and that difference must
 * stay explicit rather than be inferred from call sites:
 *   - `mortalityCount` ACCUMULATES: each tap is a bird found dead, counted
 *     one at a time, so successive deltas add up into a running total.
 *   - `feedKg` / `waterL` REPLACE: each entry is a reading of the day's
 *     total consumption so far, not an increment — the latest value wins.
 *
 * Pure function, no native modules, trivially unit-tested (see
 * `__tests__/dailyAccumulator.test.ts`).
 */

export type DailyDraft = {
  mortalityCount: number;
  feedKg: number;
  waterL: number;
};

const ZERO_DRAFT: DailyDraft = { mortalityCount: 0, feedKg: 0, waterL: 0 };

/**
 * Folds a `delta` into `existing` (or a zeroed draft when `existing` is
 * `null`, e.g. the first entry of the day).
 *
 * - `mortalityCount`: added onto the existing total, then clamped at a
 *   floor of 0 — a correction (a negative delta) can reduce the count but
 *   can never drive it negative.
 * - `feedKg` / `waterL`: replaced by the delta's value when the caller
 *   supplies one, otherwise the existing reading is kept unchanged.
 */
export function accumulateDaily(existing: DailyDraft | null, delta: Partial<DailyDraft>): DailyDraft {
  const base = existing ?? ZERO_DRAFT;

  const mortalityCount = Math.max(0, base.mortalityCount + (delta.mortalityCount ?? 0));
  const feedKg = delta.feedKg ?? base.feedKg;
  const waterL = delta.waterL ?? base.waterL;

  return { mortalityCount, feedKg, waterL };
}
