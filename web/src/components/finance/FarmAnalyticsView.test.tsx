import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { FarmAnalyticsView } from "./FarmAnalyticsView";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { FarmAnalytics } from "@/types";

let hasInventory = true;
vi.mock("@/hooks/useInventoryGating", () => ({
  useInventoryGating: () => ({ hasInventory }),
}));

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

const negativeMarginAnalytics: FarmAnalytics = {
  ...analytics,
  totalRevenueXof: 200000,
  totalExpenseXof: 350000,
  marginXof: -150000,
};

const emptyAnalytics: FarmAnalytics = {
  totalRevenueXof: 0,
  directSalesXof: 0,
  paidOrdersXof: 0,
  totalExpenseXof: 0,
  marginXof: 0,
  expensesByCategory: [],
  revenueByUnit: [],
};

function mockFetchOnce(data: unknown, balances: unknown[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/balances")) return respond(balances);
      return respond(data);
    }),
  );
}

// Intl currency formatting inserts non-breaking / narrow-no-break spaces; normalize whitespace
// on both sides before matching so the query isn't defeated by those characters.
function findByFormattedCurrency(amount: number) {
  const target = formatCurrency(amount).replace(/\s+/g, " ");
  return screen.findByText((content) => content.replace(/\s+/g, " ") === target);
}

function mockFetchWithFailingBalances(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/balances")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ type: "about:blank", title: "Accès refusé", status: 403 }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return respond(data);
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  hasInventory = true;
});

describe("FarmAnalyticsView", () => {
  beforeEach(() => {
    mockFetchOnce(analytics);
  });

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

  it("colors the margin red when negative and green when non-negative", async () => {
    mockFetchOnce(negativeMarginAnalytics);
    const { unmount } = renderWithProviders(<FarmAnalyticsView farmId={1} />);

    const negativeMargin = await findByFormattedCurrency(negativeMarginAnalytics.marginXof);
    expect(negativeMargin).toHaveStyle({ color: colors.error.main });
    unmount();

    mockFetchOnce(analytics);
    renderWithProviders(<FarmAnalyticsView farmId={2} />);

    const positiveMargin = await findByFormattedCurrency(analytics.marginXof);
    expect(positiveMargin).toHaveStyle({ color: colors.success.main });
  });

  it("shows the empty-data fallback when revenue and expenses are both zero", async () => {
    mockFetchOnce(emptyAnalytics);
    renderWithProviders(<FarmAnalyticsView farmId={1} />);

    expect(
      await screen.findByText("Aucune donnée financière pour le moment."),
    ).toBeInTheDocument();
  });

  it("sums only strictly positive supplier balances into the amount owed", async () => {
    mockFetchOnce(analytics, [
      { supplierId: 1, supplierName: "Provende du Sahel", balanceXof: 120000 },
      { supplierId: 2, supplierName: "Avance réglée", balanceXof: -50000 },
      { supplierId: 3, supplierName: "Compte soldé", balanceXof: 0 },
    ]);
    renderWithProviders(<FarmAnalyticsView farmId={1} />);

    expect(await screen.findByText("Dû aux fournisseurs")).toBeInTheDocument();
    expect(await findByFormattedCurrency(120000)).toBeInTheDocument();
  });

  it("does not render a zero total when the supplier balances query fails", async () => {
    mockFetchWithFailingBalances(analytics);
    renderWithProviders(<FarmAnalyticsView farmId={1} />);

    expect(await screen.findByText("Dû aux fournisseurs")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText((content) => content.replace(/\s+/g, " ") === formatCurrency(0).replace(/\s+/g, " "))).toBeNull();
  });

  it("does not render a zero total when the member lacks inventory access", async () => {
    hasInventory = false;
    mockFetchOnce(analytics);
    renderWithProviders(<FarmAnalyticsView farmId={1} />);

    expect(await screen.findByText("Dû aux fournisseurs")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
