import type { DashboardPeriodState, PeriodPreset } from "@/types/dashboard";

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "mtd", label: "Ce mois" },
];

export function periodToQuery(s: DashboardPeriodState): Record<string, string> {
  if (s.kind === "custom" && s.from && s.to) return { from: s.from, to: s.to };
  return { period: s.preset ?? "30d" };
}
