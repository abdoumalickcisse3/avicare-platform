import type { DashboardResponse } from "@/types/dashboard";

/**
 * Kind of value the tile represents — drives formatting in the UI.
 * "currency" → formatCurrency (XOF); "count" → formatNumber.
 */
export type TileKind = "currency" | "count";

/**
 * A single hero tile produced by pickHeroTiles.
 *
 * - `key`    Stable identifier (used as React key and for testing).
 * - `label`  Human-readable label displayed below the value.
 * - `value`  Raw number (formatted by the tile component).
 * - `kind`   Drives the formatter: "currency" | "count".
 * - `series` Optional number[] for a SparkLineChart (CA revenue series).
 * - `alert`  When true the tile renders in warning colour (value > 0).
 */
export interface HeroTile {
  key: string;
  label: string;
  value: number;
  kind: TileKind;
  series?: number[];
  alert?: boolean;
}

const MAX_TILES = 4;

/**
 * Adaptive hero-tile selection.
 *
 * Builds a priority-ordered pool of candidate tiles from whichever modules are
 * present in the API response, then slices to MAX_TILES (4). Inactive modules
 * are simply absent from the pool — no placeholder tiles are ever produced.
 *
 * Priority order (matches the design brief):
 *   CA → Impayés → Effectif vivant → [Valeur stock — Phase 3] →
 *   [Stock bas — Phase 3] → Mortalité → Cmd. à livrer →
 *   Vaccinations → Traitements → Fact. à encaisser
 *
 * Defensive: treats optional/nullable fields as absent (`?? []`).
 */
export function pickHeroTiles(data: DashboardResponse): HeroTile[] {
  const pool: HeroTile[] = [];
  const c = data.commercial;
  const l = data.livestock;

  // 1. CA (commercial module key KPI)
  if (c) {
    pool.push({
      key: "ca",
      label: "CA période",
      value: c.revenueXof,
      kind: "currency",
      series: (c.revenueSeries ?? []).map((p) => p.valueXof),
    });
  }

  // 2. Impayés — alert tile when commercial is active (alert=true when value > 0)
  if (c) {
    pool.push({
      key: "impayes",
      label: "Impayés",
      value: c.overdueXof,
      kind: "currency",
      alert: c.overdueXof > 0,
    });
  }

  // 3. Effectif vivant (livestock module key KPI)
  if (l) {
    pool.push({
      key: "effectif",
      label: "Effectif vivant",
      value: l.totalHeadcount,
      kind: "count",
    });
  }

  // 4. Valeur stock (inventory module key KPI) — Phase 3, inventory is opaque; skipped for now.
  // 5. Stock bas alert (inventory) — Phase 3; skipped for now.

  // 6. Mortalité (livestock fallback)
  if (l) {
    pool.push({
      key: "morts",
      label: "Mortalité",
      value: l.deaths,
      kind: "count",
    });
  }

  // 7. Commandes à livrer (commercial fallback)
  if (c) {
    pool.push({
      key: "cmd-livrer",
      label: "Cmd. à livrer",
      value: c.ordersToDeliver,
      kind: "count",
    });
  }

  // 8. Vaccinations (livestock fallback)
  if (l) {
    pool.push({
      key: "vaccins",
      label: "Vaccinations",
      value: l.vaccinationsCount,
      kind: "count",
    });
  }

  // 9. Traitements (livestock fallback)
  if (l) {
    pool.push({
      key: "traitements",
      label: "Traitements",
      value: l.treatmentsCount,
      kind: "count",
    });
  }

  // 10. Factures à encaisser (commercial fallback)
  if (c) {
    pool.push({
      key: "fact-encaisser",
      label: "Fact. à encaisser",
      value: c.invoicesToCollect,
      kind: "count",
    });
  }

  return pool.slice(0, MAX_TILES);
}
