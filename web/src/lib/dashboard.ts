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

/**
 * Resolve a period into concrete dates (inclusive, `YYYY-MM-DD`).
 *
 * The dashboard endpoint resolves presets itself; the finance analytics endpoint takes plain
 * dates. Rather than teach a second endpoint the preset vocabulary — or let the finance page
 * invent its own idea of "ce mois" — the resolution lives here, once, and both callers share it.
 */
export function periodToRange(s: DashboardPeriodState): { from: string; to: string } {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  if (s.kind === "custom" && s.from && s.to) return { from: s.from, to: s.to };

  const today = new Date();
  const to = iso(today);
  switch (s.preset ?? "30d") {
    case "today":
      return { from: to, to };
    case "7d":
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)), to };
    case "mtd":
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to };
    default:
      return {
        from: iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)),
        to,
      };
  }
}
