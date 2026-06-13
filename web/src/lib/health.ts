import { colors } from "@/theme/tokens";
import type { ObservationSeverity, ScheduleStatus } from "@/types";

/** ISO yyyy-mm-dd for today (local). */
export const isoToday = (now: Date = new Date()): string =>
  now.toISOString().slice(0, 10);

/** Whole days between two ISO dates (b - a); negative if b is before a. */
export function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000);
}

/** Add `days` to an ISO date, returning a new ISO date. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Treatment withdrawal projection — mirrors the backend computation so the
 * dialog can preview min-sale dates before saving. endDate = start + duration
 * - 1 (inclusive); withdrawalEnd = endDate + withdrawalDays. Returns null dates
 * when the corresponding withdrawal period is unknown.
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

/** Human label for a schedule entry age, e.g. "J28" or "S6". */
export function ageLabel(value: number, unit: string): string {
  return `${unit === "WEEK" ? "S" : "J"}${value}`;
}

/** Color for a vaccination schedule status (strict palette). */
export function scheduleStatusColor(status: ScheduleStatus): string {
  switch (status) {
    case "DONE":
      return colors.success.main;
    case "LATE":
      return colors.error.main;
    default:
      return colors.neutral[400];
  }
}

export function scheduleStatusLabel(status: ScheduleStatus): string {
  switch (status) {
    case "DONE":
      return "Effectué";
    case "LATE":
      return "En retard";
    default:
      return "À venir";
  }
}

/** Color tokens for an observation severity badge. */
export function severityChip(severity: ObservationSeverity): {
  bg: string;
  fg: string;
  label: string;
} {
  switch (severity) {
    case "CRITICAL":
      return { bg: colors.error.light, fg: colors.error.dark, label: "Critique" };
    case "WARNING":
      return { bg: colors.warning.light, fg: colors.warning.dark, label: "Vigilance" };
    default:
      return { bg: colors.neutral[100], fg: colors.neutral[600], label: "Normal" };
  }
}

/** Title-case a catalog key fallback, e.g. "newcastle_vh" → "Newcastle Vh". */
export function humanizeKey(key: string): string {
  return key
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
