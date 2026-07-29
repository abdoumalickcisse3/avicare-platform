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
