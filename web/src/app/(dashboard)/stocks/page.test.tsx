import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import StocksOverviewPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/hooks/useInventoryGating", () => ({
  useInventoryGating: () => ({ farmId: 1, hasFarm: true, hasInventory: true, isLoading: false }),
}));

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const stockItems = [
  {
    id: 4,
    farmId: 1,
    articleKey: "feed_layer",
    label: "Aliment ponte",
    articleSource: "INVENTORY",
    currentQuantity: 0,
    unit: "kg",
    alertThreshold: null,
    typicalUnitPriceXof: 440,
    lastMovementAt: null,
    active: true,
    notes: null,
  },
  {
    id: 5,
    farmId: 1,
    articleKey: "coquilles_huitre",
    label: null,
    articleSource: "INVENTORY",
    currentQuantity: 12,
    unit: "sac",
    alertThreshold: null,
    typicalUnitPriceXof: null,
    lastMovementAt: null,
    active: true,
    notes: null,
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/inventory/stock-items/valuation")) {
        return respond({ farmId: 1, totalValueXof: 0, items: [] });
      }
      if (url.includes("/inventory/stock-items")) return respond(stockItems);
      if (url.includes("/inventory/alerts")) {
        return respond({
          lowStockItems: [],
          negativeStockItems: [],
          pendingPurchaseOrders: [],
          recentMovements: [],
        });
      }
      return respond(null);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("StocksOverviewPage", () => {
  it("names an article by its catalog label, and falls back to the key", async () => {
    renderWithProviders(<StocksOverviewPage />);

    // The overview lists every configured article (zero-quantity ones included); showing the
    // technical key made it read like a database dump.
    expect(await screen.findByText("Aliment ponte")).toBeInTheDocument();
    expect(screen.queryByText("feed_layer")).not.toBeInTheDocument();
    // No label in the catalog any more: the key is all we have.
    expect(screen.getByText("coquilles_huitre")).toBeInTheDocument();
  });

  it("searches on the label shown, not only on the article key", async () => {
    renderWithProviders(<StocksOverviewPage />);
    expect(await screen.findByText("Aliment ponte")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/Rechercher un article/i), "ponte");

    expect(screen.getByText("Aliment ponte")).toBeInTheDocument();
    expect(screen.queryByText("coquilles_huitre")).not.toBeInTheDocument();
  });
});
