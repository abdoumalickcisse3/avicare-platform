import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ChickCostDialog } from "./ChickCostDialog";

let lastBody: Record<string, unknown> | null = null;
let lastMethod = "";
let lastUrl = "";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function setupFetch() {
  lastBody = null;
  lastMethod = "";
  lastUrl = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      lastUrl = url;
      lastMethod = input instanceof Request ? input.method : (init?.method ?? "GET");
      if (input instanceof Request) {
        try {
          lastBody = await input.clone().json();
        } catch {
          /* no body */
        }
      } else if (init?.body) {
        lastBody = JSON.parse(init.body as string);
      }
      return respond({ id: 42, chickPurchaseCostXof: 90_000 });
    }),
  );
}

describe("ChickCostDialog", () => {
  beforeEach(() => setupFetch());
  afterEach(() => vi.unstubAllGlobals());

  it("envoie chickUnitPriceXof et ferme le dialogue", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <ChickCostDialog
        open
        onClose={onClose}
        farmId={1}
        batchId={42}
        initialCount={500}
        currentValueXof={null}
      />,
    );

    await user.type(screen.getByLabelText("Prix par poussin (FCFA)"), "300");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastUrl).toContain("/poultry-batches/42/chick-cost");
    expect(lastBody).toEqual({ chickUnitPriceXof: 300 });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("pré-remplit le prix unitaire déjà enregistré pour permettre une correction", async () => {
    renderWithProviders(
      <ChickCostDialog
        open
        onClose={vi.fn()}
        farmId={1}
        batchId={42}
        initialCount={500}
        currentValueXof={150_000}
      />,
    );

    expect(screen.getByLabelText("Prix par poussin (FCFA)")).toHaveValue("300");
    expect(screen.getByText("Modifier le coût des poussins")).toBeInTheDocument();
  });
});
