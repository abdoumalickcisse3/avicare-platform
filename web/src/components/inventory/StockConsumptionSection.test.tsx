import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { StockConsumptionSection } from "./StockConsumptionSection";

/** The farm-22 shape: a medication bought as a stock article, plus a bare platform molecule. */
const ARTICLES = [
  {
    articleKey: "hepaturyl",
    articleSource: "INVENTORY",
    label: "Hepaturyl",
    subcategory: "MEDICATION",
    unit: "L",
    typicalUnitPriceXof: 4500,
    custom: true,
  },
  {
    articleKey: "amoxicillin_50",
    articleSource: "TREATMENT",
    label: "Amoxicilline 50%",
    subcategory: "MEDICATION",
    unit: null,
    typicalUnitPriceXof: null,
    custom: false,
  },
  {
    articleKey: "feed_layer",
    articleSource: "INVENTORY",
    label: "Ponte",
    subcategory: "FEED",
    unit: "kg",
    typicalUnitPriceXof: 440,
    custom: false,
  },
];

function stubArticles() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      const body = url.includes("/inventory/catalog/articles/all")
        ? { data: ARTICLES }
        : { data: [] };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("StockConsumptionSection", () => {
  it("clears the parent value on mount", async () => {
    const onChange = vi.fn();
    renderWithProviders(<StockConsumptionSection farmId={1} open onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  });

  it("hides the article + quantity fields until toggled on", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StockConsumptionSection farmId={1} open onChange={vi.fn()} label="Décrémenter du stock" />,
    );
    expect(screen.queryByLabelText(/article à décompter/i)).not.toBeInTheDocument();

    await user.click(screen.getByText("Décrémenter du stock"));
    expect(await screen.findByLabelText(/article à décompter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quantité consommée/i)).toBeInTheDocument();
  });

  /**
   * ADR-020: filtering medications on the article SOURCE hid the only ones that actually held
   * stock. A pilot farm held 3,5 L of a hepatoprotector as an `INVENTORY` article and the
   * treatment dialog, filtering on `TREATMENT`, offered it nothing to decrement.
   */
  it("offers every medication to decrement, whichever catalog defines it", async () => {
    stubArticles();
    const user = userEvent.setup();
    renderWithProviders(
      <StockConsumptionSection
        farmId={22}
        open
        onChange={vi.fn()}
        medicationsOnly
        label="Décrémenter le médicament du stock"
      />,
    );

    await user.click(screen.getByText("Décrémenter le médicament du stock"));
    await user.click(await screen.findByLabelText(/article à décompter/i));

    expect(await screen.findByRole("option", { name: "Hepaturyl" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Amoxicilline 50%" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Ponte" })).not.toBeInTheDocument();
  });

  it("offers every article when not restricted to medications", async () => {
    stubArticles();
    const user = userEvent.setup();
    renderWithProviders(<StockConsumptionSection farmId={22} open onChange={vi.fn()} />);

    await user.click(screen.getByText("Décrémenter du stock"));
    await user.click(await screen.findByLabelText(/article à décompter/i));

    expect(await screen.findByRole("option", { name: "Ponte" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Hepaturyl" })).toBeInTheDocument();
  });
});
