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

// ── Livestock section (Phase 2) ─────────────────────────────────────────────

/** A point in a daily mortality or egg-count series. `valueXof` = raw COUNT (not money). */
export interface LivestockSeriesPoint {
  date: string;
  valueXof: number;
}

/**
 * Mirrors `LivestockSectionDto` from the backend (`@JsonInclude(NON_NULL)`).
 * Rate fields are optional+nullable: absent from JSON when null — render
 * their widgets ONLY when the value is present (not null/undefined).
 */
export interface LivestockSection {
  activeBatches: number;
  totalHeadcount: number;
  deaths: number;
  /** Mortality rate 0–100 (%). Absent when not computable. */
  mortalityRate?: number | null;
  /** Daily death counts over the period. */
  mortalitySeries: LivestockSeriesPoint[];
  /** Average daily gain in grams/day. Absent for layer flocks. */
  avgDailyGainG?: number | null;
  /** Laying rate 0–100 (%). Absent for broiler/meat flocks. */
  layingRate?: number | null;
  /** Daily egg counts over the period. Empty for non-layer flocks. */
  layingSeries: LivestockSeriesPoint[];
  /** Average daily feed consumption (kg/day) over the period. Absent when not computable. */
  dailyFeedKg?: number | null;
  vaccinationsCount: number;
  treatmentsCount: number;
}

// ── Inventory section (Phase 3 — still opaque) ──────────────────────────────

/**
 * Mirrors the backend `InventorySection` (and the web type of the same name). Snapshot KPIs
 * reflect the current state; `consumedValueXof` honours the dashboard period.
 *
 * `valuationIncomplete` is the one flag the UI must act on: an article without a price
 * contributes nothing to the value, so the figure shown is a floor, never the truth.
 */
export interface InventorySection {
  lowStockCount: number;
  stockValueXof: number;
  pricedArticles: number;
  totalArticles: number;
  consumedValueXof: number;
  valuationIncomplete: boolean;
}

export interface DashboardResponse {
  period: { kind: string; value: string; from: string; to: string };
  commercial?: CommercialSection;
  livestock?: LivestockSection;
  inventory?: InventorySection;
}
