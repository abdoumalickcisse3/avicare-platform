/**
 * Layer helpers — ported from `web/src/lib/layer.ts`: the peak laying-rate
 * target used as the reference line on the rate curve, and grade-key ordering
 * for the calibre distribution.
 */
export const TARGET_LAYING_RATE_PCT = 90;

const GRADE_ORDER = ['petit', 'moyen', 'gros', 'tres_gros', 'S', 'M', 'L', 'XL'];

export function sortGradeKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = GRADE_ORDER.indexOf(a);
    const ib = GRADE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
