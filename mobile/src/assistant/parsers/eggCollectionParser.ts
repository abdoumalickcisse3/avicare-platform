/**
 * Rules-based egg-collection parser — "ramassage du matin 320 œufs dont 4 cassés",
 * "collecte soir : 280 oeufs". Pure, offline, deterministic.
 *
 * The timeslot is what makes a collection unique per day (the backend upserts on
 * unit + date + timeslot), so a phrase without one is left to the LLM rather than guessed:
 * filing a morning collection as an evening one would silently overwrite the wrong row.
 */
import type { EggCollectionIntent, ParseContext } from '../types';
import { normalize, parseFrenchNumber, parseTrailingFrenchNumber, resolveUnit } from './util';

const COLLECTION_RE = /\b(ramassage|ramasse|collecte|collecter|recolte|oeufs?|ponte)\b/;
const EGG_MARKER = /\b(oeufs?|pondus?)\b/;
const BROKEN_MARKER = /\b(casses?|cassees?|brises?|feles?)\b/;

/**
 * Catalog keys of `egg_timeslots` (V8), matched on the words a farmer actually says.
 *
 * "après-midi" is deliberately absent: the slots are 06:00 / 12:00 / 18:00, and an afternoon sits
 * between the last two. Mapping it either way is the same guess we refuse for a missing slot —
 * it goes to the LLM, which can ask.
 */
const TIMESLOTS: { key: string; re: RegExp }[] = [
  { key: 'morning', re: /\b(matin|matinee|aube)\b/ },
  { key: 'noon', re: /\b(midi|mi journee)\b/ },
  { key: 'evening', re: /\b(soir|soiree)\b/ },
];

/** An afternoon is neither noon nor evening — bail out instead of picking one. */
const AMBIGUOUS_SLOT_RE = /\b(apres midi|apres midi)\b/;

function timeslotOf(norm: string): string | null {
  return TIMESLOTS.find((t) => t.re.test(norm))?.key ?? null;
}

/** Read the number attached to the egg marker, accepting digits or French words. */
function eggCount(norm: string): number | null {
  const m = norm.match(EGG_MARKER);
  if (m?.index != null) {
    const value = parseTrailingFrenchNumber(norm.slice(0, m.index));
    if (value != null) return value;
  }
  return parseFrenchNumber(norm);
}

export const eggCollectionParser = {
  parse(text: string, ctx: ParseContext): EggCollectionIntent | null {
    const norm = normalize(text);
    if (!COLLECTION_RE.test(norm)) return null;

    // No timeslot spoken, or an ambiguous one → do not guess: the wrong slot overwrites
    // another collection.
    if (AMBIGUOUS_SLOT_RE.test(norm)) return null;
    const timeslotKey = timeslotOf(norm);
    if (timeslotKey == null) return null;

    const totalEggs = eggCount(norm);
    if (totalEggs == null || totalEggs < 1) return null;

    // Same rule as the total: the number that ENDS the text before "cassés". When none does
    // ("cassés 320 oeufs"), no broken count was spoken and we leave it out rather than reuse
    // the total.
    const brokenMatch = norm.match(BROKEN_MARKER);
    const brokenEggs =
      brokenMatch?.index != null
        ? (parseTrailingFrenchNumber(norm.slice(0, brokenMatch.index)) ?? undefined)
        : undefined;

    return {
      kind: 'EGG_COLLECTION',
      totalEggs,
      brokenEggs: brokenEggs != null && brokenEggs <= totalEggs ? brokenEggs : undefined,
      timeslotKey,
      unitId: resolveUnit(ctx),
    };
  },
};
