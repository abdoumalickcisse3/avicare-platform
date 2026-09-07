import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";

/**
 * Toute écriture sur un bon d'achat est OWNER/MANAGER côté serveur
 * (`InventoryAccess.WRITE_MANAGER`) : créer, corriger, envoyer, réceptionner, annuler. Les actions
 * du workflow n'étaient gardées par rien — un ouvrier voyait « Envoyer au fournisseur » et
 * prenait un 403.
 *
 * Et un brouillon existe précisément pour être revu avant d'être envoyé : le backend accepte de le
 * réécrire tant qu'il est DRAFT, mais aucun front ne le proposait. Une quantité mal tapée obligeait
 * à annuler le bon et à tout ressaisir.
 */
vi.mock("@/hooks/useInventoryGating", () => ({
  useInventoryGating: () => ({ farmId: 7, hasFarm: true, hasInventory: true, isLoading: false }),
}));

let role = "OWNER";
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => role,
}));

import { PurchaseOrderDetailView } from "./PurchaseOrderDetailView";

const DRAFT = {
  id: 12,
  farmId: 7,
  orderNumber: "BA-2026-004",
  supplierId: 3,
  supplierName: "Provende du Sahel",
  status: "DRAFT",
  orderDate: "2026-09-01",
  expectedDeliveryDate: "2026-09-10",
  actualDeliveryDate: null,
  totalXof: 150000,
  notes: null,
  items: [
    {
      id: 1,
      articleKey: "MAIS",
      articleSource: "INVENTORY",
      articleLabelSnapshot: "Maïs",
      unit: "kg",
      orderedQuantity: 500,
      receivedQuantity: 0,
      unitPriceXof: 300,
      lineTotalXof: 150000,
      notes: null,
    },
  ],
};

function mockFetch(po: Record<string, unknown> = DRAFT) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = input instanceof Request ? input.url : String(input);
      // Le dialogue de correction lit aussi les fournisseurs et le catalogue d'articles.
      const data = url.includes("/suppliers")
        ? [{ id: 3, commercialName: "Provende du Sahel" }]
        : url.includes("/articles") || url.includes("/catalog")
          ? [{ articleKey: "MAIS", articleSource: "INVENTORY", label: "Maïs", unit: "kg" }]
          : po;
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  role = "OWNER";
});

describe("Bon d'achat — écritures réservées au propriétaire et au gérant", () => {
  it("n'offre aucune action d'écriture à un ouvrier", async () => {
    role = "FARMER";
    mockFetch();
    renderWithProviders(<PurchaseOrderDetailView poId={12} />);

    expect(await screen.findByRole("heading", { name: "BA-2026-004" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corriger" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Envoyer/i })).toBeNull();
  });

  it("laisse le gérant corriger un brouillon plutôt que tout ressaisir", async () => {
    role = "MANAGER";
    mockFetch();
    renderWithProviders(<PurchaseOrderDetailView poId={12} />);

    await userEvent.click(await screen.findByRole("button", { name: "Corriger" }));
    // Le dialogue s'ouvre sur CE bon, pas sur un formulaire vide.
    expect(await screen.findByText("Corriger BA-2026-004")).toBeInTheDocument();
  });

  it("n'offre pas de correction sur un bon déjà envoyé", async () => {
    // Le backend refuse : `requireStatus(po, DRAFT, "update")`.
    mockFetch({ ...DRAFT, status: "SENT" });
    renderWithProviders(<PurchaseOrderDetailView poId={12} />);

    expect(await screen.findByRole("heading", { name: "BA-2026-004" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corriger" })).toBeNull();
  });
});
