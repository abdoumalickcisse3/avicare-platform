import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { UnitAnalyticsView } from "./UnitAnalyticsView";
import type { ProductionUnit, UnitAnalytics } from "@/types";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

const UNITS: ProductionUnit[] = [
  {
    id: 1,
    farmId: 1,
    species: "BROILER",
    unitKind: "BATCH",
    breedId: 1,
    name: "Lot A",
    startDate: "2026-06-01",
    endDate: null,
    currentCount: 100,
    status: "ACTIVE",
  },
];

const ANALYTICS: UnitAnalytics = {
  unitId: 1,
  costs: [{ categoryKey: "feed", label: "Aliment", amountXof: 50000 }],
  totalCostXof: 50000,
  costPerHeadXof: 500,
  revenueXof: 120000,
  marginXof: 70000,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      // /finance/ must be matched before any generic /api/v1/farms fallback.
      if (url.includes("/finance/")) return respond(ANALYTICS);
      if (url.includes("/production-units")) return respond(UNITS);
      return respond([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("UnitAnalyticsView", () => {
  it("shows the KPIs and the cost breakdown for the default (first) unit", async () => {
    renderWithProviders(<UnitAnalyticsView farmId={1} />);

    expect(await screen.findByText("Aliment")).toBeInTheDocument();
    // Total cost (KPI) and the Aliment row share the same amount.
    expect(screen.getAllByText(/50\s*000\s*F\s*CFA/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/120\s*000\s*F\s*CFA/)).toBeInTheDocument(); // revenue
    expect(screen.getByText(/70\s*000\s*F\s*CFA/)).toBeInTheDocument(); // margin
    expect(screen.getByText(/500\s*F\s*CFA/)).toBeInTheDocument(); // cost per head
  });

  it("shows an empty state when the farm has no production unit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond([])),
    );
    renderWithProviders(<UnitAnalyticsView farmId={1} />);
    expect(await screen.findByText(/aucun lot/i)).toBeInTheDocument();
  });
});
