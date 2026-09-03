import type { DashboardPeriod } from '@/store/slices/selectionSlice';

const DAYS: Record<DashboardPeriod, number> = { '7d': 7, '30d': 30, '90d': 90 };

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Resolve the selected period into concrete dates (inclusive, `YYYY-MM-DD`).
 *
 * The dashboard endpoint resolves the `period` token itself; the finance analytics endpoint takes
 * plain dates. Rather than teach a second endpoint the token vocabulary — or let the finance
 * screen invent its own idea of "30 jours" — the resolution lives here, once.
 *
 * Local dates, not UTC: a farmer in Dakar reading "aujourd'hui" at 23h means his day, not the
 * one UTC happens to be on.
 */
export function periodToRange(period: DashboardPeriod): { from: string; to: string } {
  const today = new Date();
  const span = DAYS[period] ?? 30;
  return {
    from: iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (span - 1))),
    to: iso(today),
  };
}
