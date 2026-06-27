/** Dashboard types — mirrors DashboardResponse backend DTO. */

export type PeriodPreset = "today" | "7d" | "30d" | "mtd";

export interface DashboardPeriodState {
  kind: "preset" | "custom";
  preset?: PeriodPreset;
  from?: string;
  to?: string;
}

/**
 * Section shapes are populated progressively by Phase 1-3.
 * For Phase 0 they remain opaque (unknown) — the page only checks presence.
 */
export type CommercialSection = Record<string, unknown>;
export type LivestockSection = Record<string, unknown>;
export type InventorySection = Record<string, unknown>;

export interface DashboardResponse {
  period: { kind: string; value: string; from: string; to: string };
  commercial?: CommercialSection;
  livestock?: LivestockSection;
  inventory?: InventorySection;
}
