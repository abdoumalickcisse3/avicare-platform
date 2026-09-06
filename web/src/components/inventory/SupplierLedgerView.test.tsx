import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { SupplierLedgerView } from "./SupplierLedgerView";

vi.mock("@/hooks/useSelectedFarm", () => ({
  useSelectedFarm: () => ({ farmId: 7, isLoading: false, hasFarm: true }),
}));

const roleMock = vi.fn(() => "OWNER");
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => roleMock(),
}));

const STATEMENT = {
  supplierId: 3,
  balanceXof: 300000,
  entries: [
    {
      id: 1,
      entryDate: "2026-09-01",
      direction: "DEBIT",
      source: "PURCHASE_ORDER",
      amountXof: 500000,
      label: "Bon d'achat BA-12",
      method: null,
      reference: null,
      purchaseOrderId: 88,
      runningBalanceXof: 500000,
    },
    {
      id: 2,
      entryDate: "2026-09-03",
      direction: "CREDIT",
      source: "MANUAL",
      amountXof: 200000,
      label: "Versement",
      method: "CASH",
      reference: null,
      purchaseOrderId: null,
      runningBalanceXof: 300000,
    },
  ],
};

function mockFetch(onPost?: (url: string) => void) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
      if (method === "POST") {
        onPost?.(url);
        return new Response(JSON.stringify({ data: 9 }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      const data = url.includes("/ledger") ? STATEMENT : { id: 3, commercialName: "Provende du Sahel" };
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

describe("SupplierLedgerView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    roleMock.mockReturnValue("OWNER");
  });

  it("montre le solde et le relevé", async () => {
    mockFetch();
    renderWithProviders(<SupplierLedgerView supplierId={3} />);

    expect(await screen.findByText("Bon d'achat BA-12")).toBeInTheDocument();
    expect(screen.getByText("Versement")).toBeInTheDocument();
  });

  it("enregistre un paiement", async () => {
    const post = vi.fn();
    mockFetch(post);
    renderWithProviders(<SupplierLedgerView supplierId={3} />);

    await userEvent.click(await screen.findByRole("button", { name: /enregistrer un paiement/i }));
    await userEvent.type(screen.getByLabelText("Montant"), "100000");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/farms/7/inventory/suppliers/3/ledger/payments"),
      ),
    );
  });

  it("cache les actions à un membre qui n'est ni propriétaire ni gérant", async () => {
    roleMock.mockReturnValue("FARMER");
    mockFetch();
    renderWithProviders(<SupplierLedgerView supplierId={3} />);

    expect(await screen.findByText("Bon d'achat BA-12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enregistrer un paiement/i })).toBeNull();
  });
});
