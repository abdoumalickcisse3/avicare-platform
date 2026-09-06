import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { formatDate } from "@/lib/format";
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

/**
 * `onPost` receives the URL and the parsed JSON body. RTK Query hands `fetch` a `Request`
 * object (not a plain URL + `init`), so the body must be read via `input.clone().text()` —
 * `init.body` is empty in that shape.
 */
function mockFetch(opts?: {
  notifyWhatsapp?: boolean;
  onPost?: (url: string, body: Record<string, unknown>) => void;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
      if (method === "POST") {
        const rawBody = input instanceof Request ? await input.clone().text() : String(init?.body ?? "");
        opts?.onPost?.(url, rawBody ? JSON.parse(rawBody) : {});
        return new Response(JSON.stringify({ data: 9 }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      const data = url.includes("/ledger")
        ? STATEMENT
        : { id: 3, commercialName: "Provende du Sahel", notifyWhatsapp: opts?.notifyWhatsapp ?? false };
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
    mockFetch({ onPost: post });
    renderWithProviders(<SupplierLedgerView supplierId={3} />);

    await userEvent.click(await screen.findByRole("button", { name: /enregistrer un paiement/i }));
    await userEvent.type(screen.getByLabelText("Montant"), "100000");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/farms/7/inventory/suppliers/3/ledger/payments"),
        expect.anything(),
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

  it("n'offre pas la case WhatsApp si le fournisseur n'a pas activé l'avis", async () => {
    mockFetch({ notifyWhatsapp: false });
    renderWithProviders(<SupplierLedgerView supplierId={3} />);

    await userEvent.click(await screen.findByRole("button", { name: /enregistrer un paiement/i }));
    await screen.findByLabelText("Montant");

    expect(screen.queryByLabelText(/Prévenir .* par WhatsApp/i)).toBeNull();
  });

  it("case WhatsApp cochée : le paiement envoie notifySupplier: true", async () => {
    const post = vi.fn();
    mockFetch({ notifyWhatsapp: true, onPost: post });
    renderWithProviders(<SupplierLedgerView supplierId={3} />);

    await userEvent.click(await screen.findByRole("button", { name: /enregistrer un paiement/i }));
    await userEvent.type(await screen.findByLabelText("Montant"), "100000");
    await screen.findByLabelText(/Prévenir .* par WhatsApp/i);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, body] = post.mock.calls[0];
    expect(body.notifySupplier).toBe(true);
  });

  it("case WhatsApp décochée : le paiement envoie notifySupplier: false", async () => {
    const post = vi.fn();
    mockFetch({ notifyWhatsapp: true, onPost: post });
    renderWithProviders(<SupplierLedgerView supplierId={3} />);

    await userEvent.click(await screen.findByRole("button", { name: /enregistrer un paiement/i }));
    await userEvent.type(await screen.findByLabelText("Montant"), "100000");
    const checkbox = await screen.findByLabelText(/Prévenir .* par WhatsApp/i);
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, body] = post.mock.calls[0];
    expect(body.notifySupplier).toBe(false);
  });

  it("ne propose de suppression que sur la ligne saisie à la main", async () => {
    mockFetch();
    renderWithProviders(<SupplierLedgerView supplierId={3} />);

    await screen.findByText("Bon d'achat BA-12");

    const deleteButtons = screen.getAllByRole("button", { name: /^Supprimer la ligne du/i });
    expect(deleteButtons).toHaveLength(1);
    expect(deleteButtons[0]).toHaveAccessibleName(`Supprimer la ligne du ${formatDate("2026-09-03")}`);
  });
});
