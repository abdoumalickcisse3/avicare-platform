import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { QuickSaleDialog } from "./QuickSaleDialog";

// ── helpers ──────────────────────────────────────────────────────────────────

const BATCH = {
  id: 42,
  farmId: 1,
  breedId: 1,
  name: "Lot Broiler",
  startDate: "2026-01-01",
  status: "ACTIVE",
  currentCount: 50,
  initialCount: 60,
  targetWeightG: null,
  targetAgeDays: null,
};

const TRAY_STOCK = {
  farmId: 1,
  fullTraysCount: 8,
  emptyTraysCount: 0,
  updatedAt: "2026-01-01T00:00:00Z",
};

const ARTICLES = [
  {
    articleKey: "CHICKEN",
    articleSource: "INVENTORY",
    label: "Poulet entier",
    subcategory: "PRODUCT",
    unit: "u",
    typicalUnitPriceXof: 5000,
  },
];

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function setupFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      // RTK Query passes a Request object; extract the URL string.
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("poultry-batches")) return respond([BATCH]);
      if (url.includes("tray-stock")) return respond(TRAY_STOCK);
      if (url.includes("inventory/catalog/articles")) return respond(ARTICLES);
      if (url.includes("commercial/clients")) return respond([]);
      return respond([]);
    }),
  );
}

function setup() {
  return renderWithProviders(<QuickSaleDialog open farmId={1} onClose={vi.fn()} />);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("QuickSaleDialog — production availability", () => {
  beforeEach(() => {
    setupFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("affiche la section production avec 50 têtes restantes (chair) et 8 plateaux disponibles (œufs)", async () => {
    setup();
    expect(await screen.findByText("50 têtes restantes")).toBeInTheDocument();
    expect(await screen.findByText("8 plateaux disponibles")).toBeInTheDocument();
  });

  it("désactive le bouton « Valider la vente » si la quantité dépasse le disponible", async () => {
    const user = userEvent.setup();
    setup();

    // Wait for broiler lot card to appear, then click it to add a line
    const lotCard = await screen.findByText("50 têtes restantes");
    const card = lotCard.closest("[role='button']") as HTMLElement;
    await user.click(card);

    // Find the quantity input (shows "1" after adding the line)
    const qtyInput = screen.getByDisplayValue("1");

    // Set quantity above available stock (51 > 50)
    fireEvent.change(qtyInput, { target: { value: "51" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Valider la vente/i })).toBeDisabled();
    });
    expect(screen.getByText(/Dépasse le disponible \(50\)/)).toBeInTheDocument();
  });

  it("laisse la validation possible si la quantité est dans les limites", async () => {
    const user = userEvent.setup();
    setup();

    const lotCard = await screen.findByText("50 têtes restantes");
    const card = lotCard.closest("[role='button']") as HTMLElement;
    await user.click(card);

    // Default quantity = 1 ≤ 50 → button should be enabled
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Valider la vente/i })).not.toBeDisabled();
    });
  });

  it("ne propose que la production — pas les articles d'inventaire « produit »", async () => {
    setup();
    // Wait until production has loaded so the dialog body is settled.
    await screen.findByText("50 têtes restantes");
    // Even though an inventory PRODUCT article exists in the catalog, it is not offered here.
    expect(screen.queryByText("Poulet entier")).not.toBeInTheDocument();
  });
});
