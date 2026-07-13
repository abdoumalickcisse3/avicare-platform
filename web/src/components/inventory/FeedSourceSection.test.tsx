import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { FeedSourceSection } from "./FeedSourceSection";

const ARTICLES = [
  { articleKey: "mais", articleSource: "INVENTORY", label: "Maïs", subcategory: "FEED", unit: "kg", typicalUnitPriceXof: 300, custom: false },
  { articleKey: "soja", articleSource: "INVENTORY", label: "Soja", subcategory: "FEED", unit: "kg", typicalUnitPriceXof: 500, custom: false },
];
const FORMULAS = {
  platformFormulas: [
    { key: "starter", label: "Démarrage", targetBreedKeys: [], targetPhase: "STARTER", targetAgeDaysMin: null, targetAgeDaysMax: null, ingredients: [{ articleKey: "mais", articleSource: "INVENTORY", percentage: 70 }, { articleKey: "soja", articleSource: "INVENTORY", percentage: 30 }], estimatedCostPer100kgXof: null },
  ],
  farmFormulas: [],
};

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/feed-formulas")) return respond(FORMULAS);
      if (url.includes("/articles")) return respond(ARTICLES);
      if (url.includes("/stock-items")) return respond([]);
      return respond([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("FeedSourceSection", () => {
  it("defaults to 'Aucun' and emits null/null", () => {
    const onChange = vi.fn();
    renderWithProviders(<FeedSourceSection farmId={1} open onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith(null, null);
    expect(screen.getByRole("radio", { name: /aucun/i })).toBeChecked();
  });

  it("emits a feedFormula when a formula is chosen with a total kg", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<FeedSourceSection farmId={1} open onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: /formule/i }));
    await user.click(await screen.findByRole("combobox", { name: /formule/i }));
    await user.click(await screen.findByText("Démarrage"));
    await user.type(screen.getByLabelText(/total.*kg/i), "100");

    expect(onChange).toHaveBeenLastCalledWith(null, { formulaKey: "starter", totalKg: 100 });
  });
});
