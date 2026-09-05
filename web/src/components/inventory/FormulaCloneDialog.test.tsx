import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { FormulaCloneDialog } from "./FormulaCloneDialog";

const TEMPLATES = [
  { key: "demarrage_chair", label: "Démarrage chair", targetBreedKeys: [], targetPhase: "STARTER", targetAgeDaysMin: 0, targetAgeDaysMax: 21, ingredients: [], estimatedCostPer100kgXof: null },
];

const DETAIL = {
  ...TEMPLATES[0],
  ingredients: [
    { articleKey: "corn_crushed", articleSource: "INVENTORY", percentage: 60 },
    { articleKey: "soybean_meal", articleSource: "INVENTORY", percentage: 40 },
  ],
  estimatedCostPer100kgXof: 34500,
};

function mockApi(detail: unknown = DETAIL) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      const body = /feed-formulas\/[^/?]+$/.test(url.split("?")[0])
        ? { data: detail }
        : { data: TEMPLATES };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

function render(presetKey?: string) {
  return renderWithProviders(
    <FormulaCloneDialog open onClose={vi.fn()} farmId={1} presetKey={presetKey} />,
  );
}

describe("FormulaCloneDialog", () => {
  it("shows what the chosen template is made of, not just its name", async () => {
    // Picking a ration by its label alone is choosing what the birds eat, and what it costs,
    // without seeing either.
    mockApi();
    render("demarrage_chair");

    expect(await screen.findByText("corn_crushed")).toBeInTheDocument();
    expect(screen.getByText("60 %")).toBeInTheDocument();
    expect(screen.getByText("soybean_meal")).toBeInTheDocument();
  });

  it("gives the cost at today's catalog prices", async () => {
    mockApi();
    render("demarrage_chair");

    expect(await screen.findByText(/les 100 kg, aux prix du catalogue/i)).toBeInTheDocument();
  });

  it("says why the cost is missing instead of showing nothing", async () => {
    mockApi({ ...DETAIL, estimatedCostPer100kgXof: null });
    render("demarrage_chair");

    expect(
      await screen.findByText(/un ingrédient n'a pas de prix au catalogue/i),
    ).toBeInTheDocument();
  });

  it("still lets the farmer clone when the composition cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        if (/feed-formulas\/[^/?]+$/.test(url.split("?")[0])) {
          return new Response("{}", { status: 500 });
        }
        return new Response(JSON.stringify({ data: TEMPLATES }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    render("demarrage_chair");

    expect(await screen.findByText(/composition indisponible/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cloner/i })).toBeEnabled();
  });

  it("asks for nothing before a template is chosen", async () => {
    mockApi();
    render();

    await userEvent.click(screen.getByLabelText(/modèle source/i));
    expect(screen.queryByText(/composition/i)).not.toBeInTheDocument();
  });
});
