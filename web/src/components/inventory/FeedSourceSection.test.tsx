import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { FeedSourceSection } from "./FeedSourceSection";

const ARTICLES = [
  { articleKey: "mais", articleSource: "INVENTORY", label: "Maïs", subcategory: "FEED", unit: "kg", typicalUnitPriceXof: 300, custom: false },
  { articleKey: "soja", articleSource: "INVENTORY", label: "Soja", subcategory: "FEED", unit: "kg", typicalUnitPriceXof: 500, custom: false },
];

/**
 * The layer-feed mix-up a pilot farm hit: the platform article "Ponte" had never received a
 * single entry while the farm's own "Pondeuse" held 150 kg, and the picker showed neither
 * quantity until after the choice was made.
 */
const LAYER_ARTICLES = [
  { articleKey: "feed_layer", articleSource: "INVENTORY", label: "Ponte", subcategory: "FEED", unit: "kg", typicalUnitPriceXof: 440, custom: false },
  { articleKey: "pondeuse", articleSource: "INVENTORY", label: "Pondeuse", subcategory: "FEED", unit: "kg", typicalUnitPriceXof: 450, custom: true },
];
const LAYER_STOCK = [
  { id: 20, farmId: 1, articleKey: "feed_layer", label: "Ponte", articleSource: "INVENTORY", currentQuantity: 0, unit: "kg", alertThreshold: null, typicalUnitPriceXof: 440, lastMovementAt: null, active: true, notes: null },
  { id: 10, farmId: 1, articleKey: "pondeuse", label: "Pondeuse", articleSource: "INVENTORY", currentQuantity: 150, unit: "kg", alertThreshold: null, typicalUnitPriceXof: 450, lastMovementAt: null, active: true, notes: null },
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

  it("shows what is left of each article, and lists the ones in stock first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.includes("/feed-formulas")) return respond(FORMULAS);
        if (url.includes("/articles")) return respond(LAYER_ARTICLES);
        if (url.includes("/stock-items")) return respond(LAYER_STOCK);
        return respond([]);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<FeedSourceSection farmId={1} open onChange={vi.fn()} />);

    await user.click(screen.getByRole("radio", { name: /article/i }));
    await user.click(await screen.findByRole("combobox", { name: /article à décompter/i }));

    const options = await screen.findAllByRole("option");
    // The one that actually holds the feed comes first, with its quantity in plain sight.
    expect(options[0]).toHaveTextContent("Pondeuse");
    expect(options[0]).toHaveTextContent("150");
    expect(options[1]).toHaveTextContent("Ponte");
    expect(options[1]).toHaveTextContent(/0\s*kg/);
  });
});
