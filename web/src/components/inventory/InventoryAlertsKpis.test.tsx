import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { InventoryAlertsKpis } from "./InventoryAlertsKpis";

describe("InventoryAlertsKpis", () => {
  it("renders the four KPI labels", () => {
    renderWithProviders(
      <InventoryAlertsKpis totalArticles={47} lowStockCount={0} totalValueXof={2850000} pendingOrdersCount={3} />,
    );
    expect(screen.getByText("Articles totaux")).toBeInTheDocument();
    expect(screen.getByText("Stock bas")).toBeInTheDocument();
    expect(screen.getByText("Valeur du stock")).toBeInTheDocument();
    expect(screen.getByText("Bons d'achat en cours")).toBeInTheDocument();
  });

  it("flags an action when stock is low", () => {
    renderWithProviders(
      <InventoryAlertsKpis totalArticles={47} lowStockCount={5} totalValueXof={0} pendingOrdersCount={0} />,
    );
    expect(screen.getByText("Action requise")).toBeInTheDocument();
  });

  it("shows the all-clear hint when no low stock", () => {
    renderWithProviders(
      <InventoryAlertsKpis totalArticles={1} lowStockCount={0} totalValueXof={0} pendingOrdersCount={0} />,
    );
    expect(screen.getByText("Tout est en ordre")).toBeInTheDocument();
  });
});
