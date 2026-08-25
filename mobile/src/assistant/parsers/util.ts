/**
 * Shared helpers for the rules parsers — text normalization and lot resolution.
 */
import type { ParseContext } from '../types';

/** lowercase + strip accents + hyphens→spaces + collapse whitespace. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Resolve the lot: explicit context lot, else the single active lot, else null
 * (→ the assistant asks which one). */
export function resolveUnit(ctx: ParseContext): number | null {
  if (ctx.unitId != null) return ctx.unitId;
  if (ctx.activeUnits && ctx.activeUnits.length === 1) return ctx.activeUnits[0]!.id;
  return null;
}

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
 *
 * Shared by every rules parser: a farmer says "douze" as readily as "12", and each parser
 * re-implementing this would drift.
 */
export function parseFrenchNumber(raw: string): number | null {
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

/**
 * Parse the French number that ENDS `raw` — the one immediately preceding a unit marker.
 *
 * `parseFrenchNumber` returns the first number it finds, which is wrong when several quantities
 * share a phrase: in "douze morts quatre-vingts kg", the kilos are the trailing number, not the
 * leading one. Walks back from the end collecting number words, then parses that tail.
 */
export function parseTrailingFrenchNumber(raw: string): number | null {
  const words = normalize(raw).split(' ').filter(Boolean);
  const tail: string[] = [];

  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i]!;
    const isNumberWord =
      /^\d+$/.test(w) ||
      w === 'et' ||
      w === 'vingts' ||
      UNITS[w] != null ||
      TENS[w] != null ||
      w === 'quatre' ||
      w === 'vingt' ||
      w === 'soixante';
    if (!isNumberWord) break;
    tail.unshift(w);
  }

  return tail.length === 0 ? null : parseFrenchNumber(tail.join(' '));
}
