/** Dashboard types — mirrors DashboardResponse backend DTO. */

export type PeriodPreset = "today" | "7d" | "30d" | "mtd";

export interface DashboardPeriodState {
  kind: "preset" | "custom";
  preset?: PeriodPreset;
  from?: string;
  to?: string;
}

// ── Commercial section (Phase 1) ────────────────────────────────────────────

export interface RevenuePoint {
  date: string;
  valueXof: number;
}

export interface TopEntry {
  clientId: number;
  name: string;
  valueXof: number;
}

export interface CommercialSection {
  revenueXof: number;
  revenueSeries: RevenuePoint[];
  outstandingXof: number;
  overdueXof: number;
  topClients: TopEntry[];
  topDebtors: TopEntry[];
  ordersToDeliver: number;
  invoicesToCollect: number;
}

// ── Other sections (Phases 2-3 — still opaque) ──────────────────────────────

export type LivestockSection = Record<string, unknown>;
export type InventorySection = Record<string, unknown>;

export interface DashboardResponse {
  period: { kind: string; value: string; from: string; to: string };
  commercial?: CommercialSection;
  livestock?: LivestockSection;
  inventory?: InventorySection;
}
