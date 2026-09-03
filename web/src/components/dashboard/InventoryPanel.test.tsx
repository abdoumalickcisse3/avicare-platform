import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { InventoryPanel } from "./InventoryPanel";
import type { InventorySection } from "@/types/dashboard";

const base: InventorySection = {
  lowStockCount: 2,
  stockValueXof: 450_000,
  pricedArticles: 4,
  totalArticles: 4,
  consumedValueXof: 80_000,
  valuationIncomplete: false,
};

const render = (override: Partial<InventorySection> = {}) =>
  renderWithProviders(<InventoryPanel data={{ ...base, ...override }} />);

describe("InventoryPanel", () => {
  it("shows what is on hand, what it is worth and what left", () => {
    render();

    expect(screen.getByText("Valeur du stock")).toBeInTheDocument();
    expect(screen.getByText("Articles sous le seuil")).toBeInTheDocument();
    expect(screen.getByText("Consommé (période)")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // low stock count
  });

  it("warns that the value is a floor when an article has no price", () => {
    render({ pricedArticles: 2, totalArticles: 4, valuationIncomplete: true });

    expect(screen.getByText(/2 articles n'ont pas de prix/)).toBeInTheDocument();
    expect(screen.getByText(/la valeur réelle est plus élevée/i)).toBeInTheDocument();
  });

  it("uses the singular for a single unpriced article", () => {
    render({ pricedArticles: 3, totalArticles: 4, valuationIncomplete: true });

    expect(screen.getByText(/1 article n'a pas de prix/)).toBeInTheDocument();
  });

  it("stays silent when every article is priced", () => {
    render();

    expect(screen.queryByText(/pas de prix/)).not.toBeInTheDocument();
  });
});
