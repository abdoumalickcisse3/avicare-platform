import { describe, expect, it } from "vitest";
import type { CommercialSection, DashboardResponse, LivestockSection } from "@/types/dashboard";
import { pickHeroTiles } from "./dashboardHero";

// ── Fixture builders ──────────────────────────────────────────────────────────

const makeCommercial = (overrides: Partial<CommercialSection> = {}): CommercialSection => ({
  revenueXof: 1_000_000,
  revenueSeries: [
    { date: "2026-06-01", valueXof: 300_000 },
    { date: "2026-06-15", valueXof: 700_000 },
  ],
  outstandingXof: 200_000,
  overdueXof: 50_000,
  topClients: [],
  topDebtors: [],
  ordersToDeliver: 3,
  invoicesToCollect: 2,
  ...overrides,
});

const makeLivestock = (overrides: Partial<LivestockSection> = {}): LivestockSection => ({
  activeBatches: 2,
  totalHeadcount: 5_000,
  deaths: 10,
  mortalityRate: 0.2,
  mortalitySeries: [],
  layingSeries: [],
  vaccinationsCount: 5,
  treatmentsCount: 2,
  ...overrides,
});

const makePeriod = () => ({
  kind: "preset",
  value: "30d",
  from: "2026-06-01",
  to: "2026-06-30",
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("pickHeroTiles", () => {
  it("all 3 modules active → exactly 4 tiles", () => {
    const data: DashboardResponse = {
      period: makePeriod(),
      commercial: makeCommercial(),
      livestock: makeLivestock(),
      inventory: {
        lowStockCount: 2,
        stockValueXof: 450_000,
        pricedArticles: 3,
        totalArticles: 4,
        consumedValueXof: 80_000,
        valuationIncomplete: true,
      },
    };
    const tiles = pickHeroTiles(data);
    expect(tiles).toHaveLength(4);
  });

  it("commercial-only → 4 commercial tiles (CA, Impayés, Cmd livrer, Fact encaisser)", () => {
    const data: DashboardResponse = {
      period: makePeriod(),
      commercial: makeCommercial(),
    };
    const tiles = pickHeroTiles(data);
    expect(tiles).toHaveLength(4);
    const keys = tiles.map((t) => t.key);
    expect(keys).toEqual(["ca", "impayes", "cmd-livrer", "fact-encaisser"]);
  });

  it("livestock-only → up to 4 livestock tiles, starting with effectif", () => {
    const data: DashboardResponse = {
      period: makePeriod(),
      livestock: makeLivestock(),
    };
    const tiles = pickHeroTiles(data);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(4);
    expect(tiles[0].key).toBe("effectif");
  });

  it("alert tile is impayés (with alert=true) when commercial is active and overdueXof > 0", () => {
    const data: DashboardResponse = {
      period: makePeriod(),
      commercial: makeCommercial({ overdueXof: 75_000 }),
      livestock: makeLivestock(),
    };
    const tiles = pickHeroTiles(data);
    const alertTile = tiles.find((t) => t.alert === true);
    expect(alertTile).toBeDefined();
    expect(alertTile?.key).toBe("impayes");
  });

  it("no impayés tile when commercial is inactive (livestock-only)", () => {
    const data: DashboardResponse = {
      period: makePeriod(),
      livestock: makeLivestock(),
    };
    const tiles = pickHeroTiles(data);
    expect(tiles.find((t) => t.key === "impayes")).toBeUndefined();
  });

  it("impayés tile has alert=false when overdueXof is 0", () => {
    const data: DashboardResponse = {
      period: makePeriod(),
      commercial: makeCommercial({ overdueXof: 0 }),
    };
    const tiles = pickHeroTiles(data);
    const impayesTile = tiles.find((t) => t.key === "impayes");
    expect(impayesTile).toBeDefined();
    expect(impayesTile?.alert).toBe(false);
  });

  it("no active module → empty array", () => {
    const data: DashboardResponse = {
      period: makePeriod(),
    };
    expect(pickHeroTiles(data)).toHaveLength(0);
  });

  it("never produces a tile with missing label or key", () => {
    const data: DashboardResponse = {
      period: makePeriod(),
      commercial: makeCommercial(),
      livestock: makeLivestock(),
    };
    for (const tile of pickHeroTiles(data)) {
      expect(tile.key).toBeTruthy();
      expect(tile.label).toBeTruthy();
      expect(typeof tile.value).toBe("number");
    }
  });

  it("CA tile carries sparkline series extracted from revenueSeries", () => {
    const data: DashboardResponse = {
      period: makePeriod(),
      commercial: makeCommercial(),
    };
    const tiles = pickHeroTiles(data);
    const caTile = tiles.find((t) => t.key === "ca");
    expect(caTile?.series).toEqual([300_000, 700_000]);
  });

  it("CA tile has empty series when revenueSeries is empty", () => {
    const data: DashboardResponse = {
      period: makePeriod(),
      commercial: makeCommercial({ revenueSeries: [] }),
    };
    const caTile = pickHeroTiles(data).find((t) => t.key === "ca");
    expect(caTile?.series).toEqual([]);
  });

  it("mixed: CA comes before effectif in priority order", () => {
    const data: DashboardResponse = {
      period: makePeriod(),
      commercial: makeCommercial(),
      livestock: makeLivestock(),
    };
    const tiles = pickHeroTiles(data);
    const caIdx = tiles.findIndex((t) => t.key === "ca");
    const effectifIdx = tiles.findIndex((t) => t.key === "effectif");
    expect(caIdx).toBeLessThan(effectifIdx);
  });

  it("impayés comes before effectif in priority order", () => {
    const data: DashboardResponse = {
      period: makePeriod(),
      commercial: makeCommercial(),
      livestock: makeLivestock(),
    };
    const tiles = pickHeroTiles(data);
    const impayesIdx = tiles.findIndex((t) => t.key === "impayes");
    const effectifIdx = tiles.findIndex((t) => t.key === "effectif");
    expect(impayesIdx).toBeLessThan(effectifIdx);
  });
});
