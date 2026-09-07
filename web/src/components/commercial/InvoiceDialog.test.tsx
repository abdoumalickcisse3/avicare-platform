import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";

/**
 * Une source déjà facturée ne doit pas *disparaître* de la liste : elle y reste, désactivée, avec
 * son numéro. Elle sortait sans un mot — on ouvrait « Nouvelle facture », on ne trouvait pas sa
 * vente, et rien ne disait pourquoi.
 *
 * Et depuis V56, une facture ANNULÉE ne retient plus sa source : la vente redevient facturable.
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { InvoiceDialog } from "./InvoiceDialog";

const SALE = {
  id: 5,
  farmId: 7,
  saleNumber: "V-2026-005",
  status: "COMPLETED",
  saleDate: "2026-09-01",
  totalXof: 22000,
  clientId: 3,
  items: [],
};

function mockFetch(invoices: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = input instanceof Request ? input.url : String(input);
      const data = url.includes("/invoices")
        ? invoices
        : url.includes("/sales")
          ? [SALE]
          : [];
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

const setup = () => renderWithProviders(<InvoiceDialog open onClose={vi.fn()} farmId={7} />);

afterEach(() => vi.unstubAllGlobals());

describe("InvoiceDialog — sources à facturer", () => {
  it("propose une vente terminée non facturée", async () => {
    mockFetch([]);
    setup();

    await userEvent.click(await screen.findByRole("combobox", { name: "Vente" }));
    expect(await screen.findByRole("option", { name: /V-2026-005/ })).toBeInTheDocument();
  });

  it("garde la vente déjà facturée à l'écran, désactivée, avec son numéro", async () => {
    mockFetch([{ id: 1, invoiceNumber: "F-2026-007", saleId: 5, deliveryId: null, status: "ISSUED" }]);
    setup();

    await userEvent.click(await screen.findByRole("combobox", { name: "Vente" }));
    const option = await screen.findByRole("option", { name: /déjà facturée \(F-2026-007\)/ });
    expect(option).toHaveAttribute("aria-disabled", "true");
  });

  it("rend la vente facturable quand sa facture est annulée", async () => {
    mockFetch([
      { id: 1, invoiceNumber: "F-2026-007", saleId: 5, deliveryId: null, status: "CANCELLED" },
    ]);
    setup();

    await userEvent.click(await screen.findByRole("combobox", { name: "Vente" }));
    const option = await screen.findByRole("option", { name: /V-2026-005/ });
    expect(option).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText(/déjà facturée/)).toBeNull();
  });

  it("distingue « rien à facturer » de « tout est facturé »", async () => {
    mockFetch([{ id: 1, invoiceNumber: "F-2026-007", saleId: 5, deliveryId: null, status: "ISSUED" }]);
    setup();

    expect(await screen.findByText("Toutes les ventes sont déjà facturées.")).toBeInTheDocument();
  });
});
