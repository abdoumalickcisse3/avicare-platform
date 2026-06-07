import type { PerformanceScore } from "@/types";
import { colors } from "@/theme/tokens";

/** Whole days elapsed since the batch start date (>= 0). */
export function ageInDays(startDate: string): number {
  const start = new Date(startDate).getTime();
  const days = Math.floor((Date.now() - start) / 86_400_000);
  return Math.max(0, days);
}

/** Whole days from now until a future ISO date (>= 0); null if no date. */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

/** Cycle progress as a 0–100 percentage of the target age. */
export function batchProgress(
  startDate: string,
  targetAgeDays: number | null,
): number {
  if (!targetAgeDays || targetAgeDays <= 0) return 0;
  return Math.min(100, (ageInDays(startDate) / targetAgeDays) * 100);
}

/** Label + colors for a performance score badge. */
export function scoreMeta(score: PerformanceScore | null): {
  label: string;
  bg: string;
  fg: string;
} | null {
  switch (score) {
    case "AHEAD":
      return { label: "En avance", bg: colors.success.light, fg: colors.success.dark };
    case "ON_TARGET":
      return { label: "Dans l'objectif", bg: colors.primary[50], fg: colors.primary[700] };
    case "BEHIND":
      return { label: "En retard", bg: colors.warning.light, fg: colors.warning.dark };
    default:
      return null;
  }
}

/** A FETCH error that is a backend feature-gate refusal (403). */
export function isFeatureForbidden(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 403
  );
}
