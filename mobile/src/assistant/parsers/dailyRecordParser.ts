/**
 * Rules-based daily-record parser — "saisie du jour 3 morts 120 kg d'aliment 200 litres d'eau",
 * "journalier : 0 mort, 85 kg". Pure, offline, deterministic.
 *
 * Each quantity is read from its own unit marker (morts / kg / litres) rather than from position,
 * so the order the farmer speaks in does not matter and a missing figure stays undefined instead
 * of borrowing its neighbour's.
 */
import type { DailyRecordIntent, ParseContext } from '../types';
import { normalize, parseTrailingFrenchNumber, resolveUnit } from './util';

const DAILY_RE = /\b(saisie|journalier|journaliere|releve|rapport|bilan)\b.*\b(jour|journee|quotidien)?/;
const EXPLICIT_DAILY_RE = /\b(saisie du jour|saisie journaliere|journalier|journaliere|releve du jour)\b/;

/** Read the number attached to one unit, accepting digits or French words before the marker. */
function quantityBefore(norm: string, marker: RegExp): number | undefined {
  const m = norm.match(marker);
  if (!m || m.index == null) return undefined;
  // Take the number that ENDS the text before the unit, so "douze morts quatre-vingts kg"
  // reads 80 kilos and not 12.
  const value = parseTrailingFrenchNumber(norm.slice(0, m.index));
  return value == null ? undefined : value;
}

const MORTALITY_MARKER = /\b(morts?|mortes?|deces|perdus?|perdues?)\b/;
const FEED_MARKER = /\b(kg|kilos?|kilogrammes?)\b/;
const WATER_MARKER = /\b(l|litres?|litre)\b/;

export const dailyRecordParser = {
  parse(text: string, ctx: ParseContext): DailyRecordIntent | null {
    const norm = normalize(text);
    // Require an explicit "daily entry" phrasing: a bare "3 morts" is a mortality, not a day.
    if (!EXPLICIT_DAILY_RE.test(norm) && !DAILY_RE.test(norm)) return null;

    const mortalityCount = quantityBefore(norm, MORTALITY_MARKER);
    const feedKg = quantityBefore(norm, FEED_MARKER);
    const waterL = quantityBefore(norm, WATER_MARKER);

    // A daily entry with no figure at all carries nothing to confirm — let the LLM ask.
    if (mortalityCount == null && feedKg == null && waterL == null) return null;

    return {
      kind: 'DAILY_RECORD',
      // The backend requires a mortality count; an unspoken one is zero, which is what a farmer
      // means by "saisie du jour, 120 kg d'aliment".
      mortalityCount: mortalityCount ?? 0,
      feedKg,
      waterL,
      unitId: resolveUnit(ctx),
    };
  },
};
