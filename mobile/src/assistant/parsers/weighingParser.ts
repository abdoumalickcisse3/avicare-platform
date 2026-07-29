/**
 * Rules-based weighing parser — "pesée 1850 1920 2010", "peser 1850, 1920".
 * Pure, offline. Extracts the plausible gram weights (≥ 50 g filters out small
 * counts like "2 poules"). Requires the weighing keyword to avoid firing on
 * unrelated numbers.
 */
import type { ParseContext, WeighingIntent } from '../types';
import { normalize, resolveUnit } from './util';

const WEIGHING_RE = /\b(pese|pesee|peser|poids|gramme|grammes)\b/;

export const weighingParser = {
  parse(text: string, ctx: ParseContext): WeighingIntent | null {
    if (!WEIGHING_RE.test(normalize(text))) return null;

    const weights = (text.match(/\d+/g) ?? []).map(Number).filter((n) => n >= 50);
    if (weights.length === 0) return null;

    return { kind: 'WEIGHING', weights, unitId: resolveUnit(ctx) };
  },
};
