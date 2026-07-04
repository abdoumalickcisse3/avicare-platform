import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ExpenseDialog } from "./ExpenseDialog";
import type { Expense } from "@/types";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

const isoToday = new Date().toISOString().slice(0, 10);

let lastBody: Record<string, unknown> | null = null;
let lastMethod = "";

beforeEach(() => {
  lastBody = null;
  lastMethod = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
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
      // /catalog/ must be matched before the generic /api/v1/farms shape.
      if (url.includes("/catalog/")) {
        return respond([
          { category: "expense_categories", key: "feed", value: { label: "Aliment" }, custom: false },
        ]);
      }
      if (url.includes("/production-units")) {
        return respond([
          {
            id: 7,
            farmId: 1,
            species: "poultry",
            unitKind: "BATCH",
            breedId: null,
            name: "Lot A",
            startDate: "2026-01-01",
            endDate: null,
            currentCount: 500,
            status: "ACTIVE",
          },
        ]);
      }
      const created: Expense = {
        id: 1,
        categoryKey: "feed",
        amountXof: 5000,
        expenseDate: isoToday,
        label: "Sac aliment",
        notes: null,
        productionUnitId: 7,
        source: "MANUAL",
        purchaseOrderId: null,
        stockMovementId: null,
      };
      return respond(created);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("ExpenseDialog", () => {
  it("creates a manual expense with the exact payload, categories from the catalog", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExpenseDialog open onClose={vi.fn()} farmId={1} />);

    await user.click(screen.getByRole("combobox", { name: "Catégorie" }));
    await user.click(await screen.findByRole("option", { name: "Aliment" }));

    await user.type(screen.getByLabelText("Libellé"), "Sac aliment");
    await user.type(screen.getByLabelText("Montant (XOF)"), "5000");

    await user.click(screen.getByRole("combobox", { name: "Lot" }));
    await user.click(await screen.findByRole("option", { name: "Lot A" }));

    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastBody).toEqual({
      categoryKey: "feed",
      label: "Sac aliment",
      amountXof: 5000,
      expenseDate: isoToday,
      productionUnitId: 7,
    });
  });

  it("edits a MANUAL expense via PUT, preserving its id", async () => {
    const user = userEvent.setup();
    const expense: Expense = {
      id: 42,
      categoryKey: "feed",
      amountXof: 3000,
      expenseDate: "2026-06-10",
      label: "Vieux libellé",
      notes: null,
      productionUnitId: null,
      source: "MANUAL",
      purchaseOrderId: null,
      stockMovementId: null,
    };
    renderWithProviders(<ExpenseDialog open onClose={vi.fn()} farmId={1} expense={expense} />);

    const label = await screen.findByLabelText("Libellé");
    await user.clear(label);
    await user.type(label, "Nouveau libellé");

    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => expect(lastMethod).toBe("PUT"));
    expect(lastBody).toMatchObject({ label: "Nouveau libellé", categoryKey: "feed", amountXof: 3000 });
  });
});
