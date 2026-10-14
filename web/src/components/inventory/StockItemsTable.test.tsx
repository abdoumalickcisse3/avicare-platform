import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { StockItemsTable } from "./StockItemsTable";
import type { StockItem } from "@/types";

const item = (over: Partial<StockItem>): StockItem => ({
  id: 1,
  farmId: 7,
  articleKey: "charbon",
  label: "CHARBON",
  articleSource: "INVENTORY",
  currentQuantity: 10,
  unit: "SAC",
  alertThreshold: null,
  typicalUnitPriceXof: 6100,
  lastMovementAt: null,
  active: true,
  notes: null,
  ...over,
});

describe("StockItemsTable", () => {
  /**
   * Depuis ADR-018 une sortie ne peut plus creuser le solde, mais les lignes déjà négatives
   * restent : elles ne se réparent qu'en comptant le magasin. Sans ce bouton, l'éleveur voit le
   * faux chiffre sans savoir qu'il peut le corriger lui-même.
   */
  it("propose de régulariser une ligne négative", async () => {
    const onRegularise = vi.fn();
    renderWithProviders(
      <StockItemsTable items={[item({ currentQuantity: -1 })]} onRegularise={onRegularise} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /régulariser/i }));

    expect(onRegularise).toHaveBeenCalledWith(1);
  });

  it("ne le propose pas sur une ligne saine", () => {
    renderWithProviders(<StockItemsTable items={[item({})]} onRegularise={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /régulariser/i })).toBeNull();
  });
});
