/**
 * Broiler helpers — ported from `web/src/lib/poultry.ts`: the performance-score
 * badge metadata and the "days until" a forecast date.
 */
import { tokens } from '@/theme';
import type { PerformanceScore } from '@/types';

export function scoreMeta(score: PerformanceScore | null): { label: string; bg: string; fg: string } | null {
  switch (score) {
    case 'AHEAD':
      return { label: 'En avance', bg: tokens.colors.successLight, fg: tokens.colors.successDark };
    case 'ON_TARGET':
      return { label: "Dans l'objectif", bg: tokens.colors.primary[50], fg: tokens.colors.primary[700] };
    case 'BEHIND':
      return { label: 'En retard', bg: tokens.colors.warningLight, fg: tokens.colors.warningDark };
    default:
      return null;
  }
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}
