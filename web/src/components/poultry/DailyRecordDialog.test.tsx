import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { DailyRecordDialog } from "./DailyRecordDialog";

const today = new Date().toISOString().slice(0, 10);

const FARMS = [{ id: 1, name: "Ferme test", productionFocus: ["broiler"] }];
const SUBSCRIPTION = {
  id: 1,
  farmId: 1,
  status: "ACTIVE",
  planKey: null,
  expiresAt: null,
  modules: [{ moduleKey: "module.inventory", mode: "HARD", expiresAt: null }],
};
const ARTICLES = [
  { articleKey: "mais", articleSource: "INVENTORY", label: "Maïs", subcategory: "FEED", unit: "kg", typicalUnitPriceXof: 300, custom: false },
];
const FORMULAS = {
  platformFormulas: [
    { key: "starter", label: "Démarrage", targetBreedKeys: [], targetPhase: "STARTER", targetAgeDaysMin: null, targetAgeDaysMax: null, ingredients: [{ articleKey: "mais", articleSource: "INVENTORY", percentage: 100 }], estimatedCostPer100kgXof: null },
  ],
  farmFormulas: [],
};
let lastBody: Record<string, unknown> | null = null;
function ok(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status: 201, headers: { "Content-Type": "application/json" } }));
}
beforeEach(() => {
  lastBody = null;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = input instanceof Request ? input.method : (init?.method ?? "GET");
    if (url.includes("/daily-records") && method === "POST") {
      if (input instanceof Request) {
        try {
          lastBody = await input.clone().json();
        } catch {
          /* no body */
        }
      } else if (init?.body) {
        lastBody = JSON.parse(init.body as string);
      }
      return ok({ id: 1, productionUnitId: 9, recordDate: "2026-07-12", mortalityCount: 0, feedKg: 0, waterL: 0, observations: null });
    }
    if (url.includes("/feed-formulas")) return ok(FORMULAS);
    if (url.includes("/articles")) return ok(ARTICLES);
    if (url.includes("/subscription")) return ok(SUBSCRIPTION);
    if (url.endsWith("/api/v1/farms")) return ok(FARMS);
    return ok([]);
  }));
});
afterEach(() => vi.unstubAllGlobals());

function setup(existingDates: string[] = []) {
  return renderWithProviders(
    <DailyRecordDialog
      open
      onClose={vi.fn()}
      farmId={1}
      batchId={9}
      currentCount={4870}
      existingDates={existingDates}
    />,
  );
}

describe("DailyRecordDialog", () => {
  it("shows the current count and defaults the date to today", () => {
    setup();
    expect(screen.getByText(/effectif actuel/i)).toHaveTextContent("4");
    expect(screen.getByLabelText(/date de la saisie/i)).toHaveValue(today);
  });

  it("requires an integer mortality count", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(await screen.findByText("Nombre entier requis")).toBeInTheDocument();
  });

  it("warns that an existing entry for the date will be updated", () => {
    setup([today]);
    expect(screen.getByText(/elle sera mise à jour/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mettre à jour/i })).toBeInTheDocument();
  });

  it("submits a feedFormula when a formula and total kg are chosen", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(/mortalité du jour/i), "0");
    // Feed source → Formule
    await user.click(await screen.findByRole("radio", { name: /formule/i }));
    await user.click(await screen.findByRole("combobox", { name: /formule/i }));
    await user.click(await screen.findByText("Démarrage"));
    await user.type(screen.getByLabelText(/total.*kg/i), "100");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    await vi.waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody).toMatchObject({ feedFormula: { formulaKey: "starter", totalKg: 100 } });
    expect(lastBody).not.toHaveProperty("feedConsumption", expect.anything());
  });
});
