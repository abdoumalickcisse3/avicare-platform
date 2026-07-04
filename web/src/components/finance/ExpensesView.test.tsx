import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { setTokens } from "@/store/slices/authSlice";
import { ExpensesView } from "./ExpensesView";
import type { Expense, ExpenseSummary } from "@/types";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

function makeJwt(payload: unknown): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `h.${b64}.s`;
}

function ownerToken() {
  return makeJwt({ memberships: [{ farmId: 1, farmRole: "OWNER", permissions: ["*"] }] });
}

const EXPENSES: Expense[] = [
  {
    id: 1,
    categoryKey: "feed",
    amountXof: 10000,
    expenseDate: "2026-07-01",
    label: "Sac aliment",
    notes: null,
    productionUnitId: null,
    source: "MANUAL",
    purchaseOrderId: null,
    stockMovementId: null,
  },
  {
    id: 2,
    categoryKey: "feed",
    amountXof: 5000,
    expenseDate: "2026-07-02",
    label: "Achat aliment fournisseur",
    notes: null,
    productionUnitId: null,
    source: "PURCHASE",
    purchaseOrderId: 9,
    stockMovementId: null,
  },
];

const SUMMARY: ExpenseSummary = {
  categories: [{ categoryKey: "feed", amountXof: 15000 }],
  totalXof: 15000,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      // /finance/ must be matched before any generic /api/v1/farms fallback.
      if (url.includes("/finance/summary")) return respond(SUMMARY);
      if (url.includes("/finance/expenses")) return respond(EXPENSES);
      if (url.includes("/catalog/")) {
        return respond([
          { category: "expense_categories", key: "feed", value: { label: "Aliment" }, custom: false },
        ]);
      }
      if (url.includes("/production-units")) return respond([]);
      return respond([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("ExpensesView", () => {
  it("shows edit/delete actions on a MANUAL row but not on a PURCHASE row, with source badges", async () => {
    const { store } = renderWithProviders(<ExpensesView farmId={1} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));

    const manualRow = (await screen.findByText("Sac aliment")).closest("tr")!;
    const purchaseRow = screen.getByText("Achat aliment fournisseur").closest("tr")!;

    expect(within(manualRow).getByText("Manuelle")).toBeInTheDocument();
    expect(within(manualRow).getByRole("button", { name: /Modifier/i })).toBeInTheDocument();
    expect(within(manualRow).getByRole("button", { name: /Supprimer/i })).toBeInTheDocument();

    expect(within(purchaseRow).getByText("Achat")).toBeInTheDocument();
    expect(within(purchaseRow).queryByRole("button", { name: /Modifier/i })).not.toBeInTheDocument();
    expect(within(purchaseRow).queryByRole("button", { name: /Supprimer/i })).not.toBeInTheDocument();
  });

  it("hides row actions entirely when the user cannot manage the catalog (no role)", async () => {
    renderWithProviders(<ExpensesView farmId={1} />); // no token → role null
    await screen.findByText("Sac aliment");
    expect(screen.queryByRole("button", { name: /Modifier/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ajouter/i })).not.toBeInTheDocument();
  });

  it("displays the period total from the summary", async () => {
    renderWithProviders(<ExpensesView farmId={1} />);
    await screen.findByText("Sac aliment");
    expect(screen.getByText(/15\s*000\s*F\s*CFA/)).toBeInTheDocument();
  });
});
