/**
 * Rules-based mortality parser (Phase 1) — pure, offline, deterministic. Turns
 * a French phrase ("dix sont morts", "j'ai perdu 3 poules") into a
 * MortalityIntent. This is intentionally a rules parser, not an LLM: it costs
 * nothing, works offline, and covers the single Phase-1 action. An LLM parser
 * can replace it later behind the same `IntentParser` interface.
 */
import type { MortalityIntent, ParseContext } from '../types';
import { normalize, parseFrenchNumber, resolveUnit } from './util';

const MORTALITY_RE = /\b(mort|morte|morts|mortes|deces|perdu|perdus|perdue|perdues|crev|mortalit)/;

/** Extract an optional free-text reason after a causal marker. */
function extractReason(raw: string): string | undefined {
  const m = raw.match(/(?:a cause de|à cause de|parce que|cause|suite a|suite à)\s+(.+)$/i);
  const reason = m?.[1]?.trim();
  return reason && reason.length > 0 ? reason.slice(0, 100) : undefined;
}

/** Typed to return a MortalityIntent (not the whole union) so callers keep the
 * narrow type; still structurally usable wherever an `IntentParser` is expected. */
export const mortalityParser = {
  parse(text: string, ctx: ParseContext): MortalityIntent | null {
    const norm = normalize(text);
    if (!MORTALITY_RE.test(norm)) return null;

    const count = parseFrenchNumber(text);
    if (count == null || count < 1) return null;

    return {
      kind: 'MORTALITY',
      count,
      reason: extractReason(text),
      unitId: resolveUnit(ctx),
    };
  },
};
