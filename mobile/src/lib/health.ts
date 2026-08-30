/**
 * Health helpers — ported from `web/src/lib/health.ts`, colours remapped onto the field tokens.
 *
 * `projectWithdrawal` mirrors the backend arithmetic on purpose: the treatment form previews the
 * earliest sale dates before anything is saved, and a preview that disagrees with what the server
 * then computes would be worse than showing nothing.
 */
import { tokens } from '@/theme';
import type { ObservationSeverity, ScheduleStatus } from '@/types';

/** ISO `yyyy-mm-dd` for today, local — not UTC, which shifts the date after 21h in Dakar. */
export function isoToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

/** Whole days between two ISO dates (b − a); negative when b precedes a. */
export function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

/** Add `days` to an ISO date, returning a new ISO date. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoToday(d);
}

/**
 * Treatment withdrawal projection.
 *
 * `endDate = start + duration − 1` (the first day counts), and each withdrawal end is that date
 * plus the declared delay. A null delay means the catalog declares none — the form then says so
 * rather than showing a date it invented.
 */
export function projectWithdrawal(
  startDate: string,
  durationDays: number,
  withdrawalDaysMeat: number | null,
  withdrawalDaysEggs: number | null,
): {
  endDate: string;
  withdrawalEndDateMeat: string | null;
  withdrawalEndDateEggs: string | null;
} {
  const endDate = addDays(startDate, Math.max(0, durationDays - 1));
  return {
    endDate,
    withdrawalEndDateMeat:
      withdrawalDaysMeat != null ? addDays(endDate, withdrawalDaysMeat) : null,
    withdrawalEndDateEggs:
      withdrawalDaysEggs != null ? addDays(endDate, withdrawalDaysEggs) : null,
  };
}

/** Age label for a schedule step, e.g. `J28` or `S6`. */
export function ageLabel(value: number, unit: string): string {
  return `${unit === 'WEEK' ? 'S' : 'J'}${value}`;
}

/** Colour for a schedule status. Late is the only one that shouts. */
export function scheduleStatusColor(status: ScheduleStatus): string {
  switch (status) {
    case 'DONE':
      return tokens.colors.success;
    case 'LATE':
      return tokens.colors.error;
    default:
      return tokens.colors.neutral[400];
  }
}

export function scheduleStatusLabel(status: ScheduleStatus): string {
  switch (status) {
    case 'DONE':
      return 'Effectué';
    case 'LATE':
      return 'En retard';
    default:
      return 'À venir';
  }
}

/**
 * Badge colours and the French label for an observation severity.
 *
 * The label matters as much as the colour: the lists used to print the raw enum, so a farmer
 * read "CRITICAL" on a screen otherwise entirely in French.
 */
export function severityChip(severity: ObservationSeverity): {
  bg: string;
  fg: string;
  label: string;
} {
  switch (severity) {
    case 'CRITICAL':
      return { bg: tokens.colors.errorLight, fg: tokens.colors.errorDark, label: 'Critique' };
    case 'WARNING':
      return { bg: tokens.colors.warningLight, fg: tokens.colors.warningDark, label: 'Vigilance' };
    default:
      return {
        bg: tokens.colors.neutral[100],
        fg: tokens.colors.neutral[700],
        label: 'Normal',
      };
  }
}

/** Title-case a catalog key, e.g. `newcastle_vh` → `Newcastle Vh`. */
export function humanizeKey(key: string): string {
  return key
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Administration routes for vaccines and treatments (stable key → FR label). */
export const HEALTH_ROUTE_LABELS: Record<string, string> = {
  drinking_water: 'Eau de boisson',
  injectable: 'Injectable',
  ocular: 'Oculo-nasal (goutte)',
  spray: 'Nébulisation / spray',
  wing_web: "Piqûre au jabot d'aile",
  oral: 'Oral',
};

export function routeLabel(key: string): string {
  return HEALTH_ROUTE_LABELS[key] ?? humanizeKey(key);
}

/**
 * Days left before the last withdrawal ends, or null when none is running.
 *
 * The server's `active-withdrawals` answers "is any delay still running today"; this answers
 * "how many days does the farmer still have to wait", which is the number the screen shows.
 */
export function withdrawalDaysRemaining(
  treatment: { withdrawalEndDateMeat: string | null; withdrawalEndDateEggs: string | null },
  today: string = isoToday(),
): number | null {
  const remaining = [treatment.withdrawalEndDateMeat, treatment.withdrawalEndDateEggs]
    .filter((d): d is string => d !== null)
    .map((d) => daysBetween(today, d))
    .filter((d) => d > 0);
  return remaining.length > 0 ? Math.max(...remaining) : null;
}
