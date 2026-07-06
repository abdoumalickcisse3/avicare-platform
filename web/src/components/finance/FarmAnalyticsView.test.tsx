import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { FarmAnalyticsView } from "./FarmAnalyticsView";
import type { FarmAnalytics } from "@/types";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

const analytics: FarmAnalytics = {
  totalRevenueXof: 750000,
  directSalesXof: 700000,
  paidOrdersXof: 50000,
  totalExpenseXof: 350000,
  marginXof: 400000,
  expensesByCategory: [{ categoryKey: "feed", label: "Aliment", amountXof: 344000 }],
  revenueByUnit: [{ unitId: 10, unitName: "Lot A", revenueXof: 700000 }],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => respond(analytics)),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("FarmAnalyticsView", () => {
  it("renders the three KPIs, the expense breakdown and per-lot revenue", async () => {
    renderWithProviders(<FarmAnalyticsView farmId={1} />);

    expect(await screen.findByText("Total revenus")).toBeInTheDocument();
    expect(screen.getByText("Total dépenses")).toBeInTheDocument();
    expect(screen.getByText("Marge")).toBeInTheDocument();
    // ventilation dépenses
    expect(await screen.findByText("Aliment")).toBeInTheDocument();
    // revenu par lot
    expect(screen.getByText("Lot A")).toBeInTheDocument();
    // détail revenu
    expect(screen.getByText("Ventes directes")).toBeInTheDocument();
    expect(screen.getByText("Commandes payées")).toBeInTheDocument();
  });
});
