/**
 * Rules-based mortality parser (Phase 1) — pure, offline, deterministic. Turns
 * a French phrase ("dix sont morts", "j'ai perdu 3 poules") into a
 * MortalityIntent. This is intentionally a rules parser, not an LLM: it costs
 * nothing, works offline, and covers the single Phase-1 action. An LLM parser
 * can replace it later behind the same `IntentParser` interface.
 */
import type { IntentParser, ParseContext, ParsedIntent } from '../types';

/** lowercase + strip accents + hyphens→spaces + collapse whitespace. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MORTALITY_RE = /\b(mort|morte|morts|mortes|deces|perdu|perdus|perdue|perdues|crev|mortalit)/;

// 0–16 (+ variants); the rest is composed.
const UNITS: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7,
  huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14,
  quinze: 15, seize: 16,
};
// Regular tens (soixante & quatre-vingt are handled specially for 70/80/90).
const TENS: Record<string, number> = { vingt: 20, trente: 30, quarante: 40, cinquante: 50 };

/**
 * Parse the first French number (digits or words, 0–99) found in the text.
 * Digits win. Handles vingt-trois, soixante-douze (72), quatre-vingt-dix-neuf (99).
 */
function parseFrenchNumber(raw: string): number | null {
  const digit = raw.match(/\d+/);
  if (digit) return Number.parseInt(digit[0], 10);

  const words = normalize(raw).split(' ').filter(Boolean);
  let total = 0;
  let found = false;
  let i = 0;

  while (i < words.length) {
    const w = words[i]!;
    if (w === 'et') {
      i++;
      continue;
    }
    // quatre-vingt(s) → 80, then optional dix..neuf / unit
    if (w === 'quatre' && (words[i + 1] === 'vingt' || words[i + 1] === 'vingts')) {
      total += 80;
      found = true;
      i += 2;
      const nxt = words[i];
      if (nxt && UNITS[nxt] != null) {
        total += UNITS[nxt];
        i++;
      }
      continue;
    }
    // soixante → 60, then optional 0..16 (soixante-seize = 76)
    if (w === 'soixante') {
      total += 60;
      found = true;
      i++;
      const nxt = words[i];
      if (nxt && UNITS[nxt] != null) {
        total += UNITS[nxt];
        i++;
      }
      continue;
    }
    if (TENS[w] != null) {
      total += TENS[w]!;
      found = true;
      i++;
      const nxt = words[i];
      if (nxt && UNITS[nxt] != null && UNITS[nxt]! < 10) {
        total += UNITS[nxt]!;
        i++;
      }
      continue;
    }
    if (UNITS[w] != null) {
      total += UNITS[w]!;
      found = true;
      i++;
      continue;
    }
    // Non-number word: stop once a number has started, otherwise keep scanning.
    if (found) break;
    i++;
  }

  return found ? total : null;
}

/** Extract an optional free-text reason after a causal marker. */
function extractReason(raw: string): string | undefined {
  const m = raw.match(/(?:a cause de|à cause de|parce que|cause|suite a|suite à)\s+(.+)$/i);
  const reason = m?.[1]?.trim();
  return reason && reason.length > 0 ? reason.slice(0, 100) : undefined;
}

function resolveUnit(ctx: ParseContext): number | null {
  if (ctx.unitId != null) return ctx.unitId;
  if (ctx.activeUnits && ctx.activeUnits.length === 1) return ctx.activeUnits[0]!.id;
  return null;
}

export const mortalityParser: IntentParser = {
  parse(text: string, ctx: ParseContext): ParsedIntent {
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
