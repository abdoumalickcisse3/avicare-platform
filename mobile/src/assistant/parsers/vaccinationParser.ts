/**
 * Rules-based vaccination parser — "vaccination newcastle 480 sujets",
 * "j'ai vacciné 500 poulets contre la maladie de Gumboro". Pure, offline, deterministic.
 *
 * The vaccine is resolved against the farm's own catalog (passed in the parse context, served from
 * the RTK Query cache offline). Nothing is invented: a name that matches no catalog entry falls
 * through to the LLM, because a key the farm does not have produces a draft the backend rejects.
 */
import type { ParseContext, VaccinationIntent } from '../types';
import { normalize, parseFrenchNumber, resolveUnit } from './util';

const VACCINATION_RE = /\b(vaccin|vaccine|vaccins|vaccination|vacciner|vaccinee?s?)\b/;
const COUNT_MARKER = /\b(sujets?|poulets?|poules?|tetes?|oiseaux|animaux|betes?)\b/;

/** The catalog entry whose key, label or disease appears in the phrase — longest name first, so
 * "newcastle la sota" wins over a bare "newcastle" when the farm carries both. */
function matchVaccine(
  norm: string,
  vaccines: NonNullable<ParseContext['vaccines']>,
): { key: string; label: string } | null {
  const candidates = vaccines
    .flatMap((v) =>
      [v.label, v.disease, v.key]
        .filter((n): n is string => !!n && n.trim().length > 1)
        .map((name) => ({ key: v.key, label: v.label ?? v.key, needle: normalize(name) })),
    )
    .sort((a, b) => b.needle.length - a.needle.length);

  const hit = candidates.find((c) => norm.includes(c.needle));
  return hit ? { key: hit.key, label: hit.label } : null;
}

/** Read the number attached to a subject marker, else the first number in the phrase. */
function subjectsOf(norm: string): number | null {
  const m = norm.match(COUNT_MARKER);
  if (m?.index != null) {
    const before = norm.slice(0, m.index);
    const value = parseFrenchNumber(before.split(' ').slice(-4).join(' '));
    if (value != null) return value;
  }
  return parseFrenchNumber(norm);
}

export const vaccinationParser = {
  parse(text: string, ctx: ParseContext): VaccinationIntent | null {
    const norm = normalize(text);
    if (!VACCINATION_RE.test(norm)) return null;

    // Without a catalog (never fetched, so nothing cached) there is no key to resolve against.
    if (!ctx.vaccines || ctx.vaccines.length === 0) return null;

    const vaccine = matchVaccine(norm, ctx.vaccines);
    if (vaccine == null) return null;

    const subjectsCount = subjectsOf(norm);
    if (subjectsCount == null || subjectsCount < 1) return null;

    return {
      kind: 'VACCINATION',
      vaccineKey: vaccine.key,
      vaccineLabel: vaccine.label,
      subjectsCount,
      unitId: resolveUnit(ctx),
    };
  },
};
