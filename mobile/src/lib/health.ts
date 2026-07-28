/**
 * Health helpers — ported from `web/src/lib/health.ts`. Turns a catalog key
 * (`newcastle_b1`) into a readable label ("Newcastle B1").
 */
export function humanizeKey(key: string): string {
  return key
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
