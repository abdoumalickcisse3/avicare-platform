/**
 * Rules-based health-observation parser — "je constate des boiteries",
 * "observation : toux dans le lot, c'est grave". Pure, offline, deterministic.
 *
 * An observation is free text, so this parser is the loosest of the set — which makes its gate the
 * important part. It requires an explicit observation verb AND refuses phrases another parser owns
 * (a death, a weighing, a collection), so it never quietly swallows a mortality.
 */
import type { ObservationIntent, ParseContext } from '../types';
import { normalize, resolveUnit } from './util';

const OBSERVATION_RE =
  /\b(observation|observe|observer|constate|constater|remarque|remarque|symptome|symptomes|je vois|il y a des)\b/;

/** Phrases owned by a more specific parser — never reinterpret those as an observation. */
const OWNED_ELSEWHERE_RE = /\b(morts?|mortes?|deces|perdus?|pesee|peser|ramassage|collecte)\b/;

const SEVERITY: { re: RegExp; value: string }[] = [
  { re: /\b(grave|critique|urgent|urgence|beaucoup|massive?|alarmant)\b/, value: 'CRITICAL' },
  { re: /\b(inquietant|anormal|bizarre|etrange|suspect)\b/, value: 'WARNING' },
];

function severityOf(norm: string): string | undefined {
  return SEVERITY.find((s) => s.re.test(norm))?.value;
}

/** The observation itself: what follows the verb, trimmed to a usable title. */
function titleOf(text: string, norm: string): string | null {
  const m = norm.match(OBSERVATION_RE);
  if (m?.index == null) return null;
  const after = text.slice(m.index + m[0].length).replace(/^[\s:,.-]+/, '').trim();
  const title = after.length > 0 ? after : text.trim();
  return title.length > 1 ? title.slice(0, 120) : null;
}

export const observationParser = {
  parse(text: string, ctx: ParseContext): ObservationIntent | null {
    const norm = normalize(text);
    if (!OBSERVATION_RE.test(norm)) return null;
    // A death reported as "je constate 3 morts" is a mortality, not an observation.
    if (OWNED_ELSEWHERE_RE.test(norm)) return null;

    const title = titleOf(text, norm);
    if (title == null) return null;

    return {
      kind: 'HEALTH_OBSERVATION',
      title,
      severity: severityOf(norm),
      unitId: resolveUnit(ctx),
    };
  },
};
