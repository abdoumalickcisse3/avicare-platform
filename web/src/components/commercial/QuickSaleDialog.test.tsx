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

// A layer lot — must NOT be offered as a sellable meat lot.
const LAYER_BATCH = {
  id: 77,
  farmId: 1,
  breedId: 5,
  name: "Lot Pondeuse",
  startDate: "2026-01-01",
  status: "ACTIVE",
  currentCount: 30,
  initialCount: 30,
  targetWeightG: null,
  targetAgeDays: null,
};

const BREEDS = [
  { id: 1, species: "POULTRY", code: "cobb_500", name: "Cobb 500", type: "broiler", farmId: null, active: true },
  { id: 5, species: "POULTRY", code: "hyline_w36", name: "Hy-Line W-36", type: "layer", farmId: null, active: true },
];

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

const SALES_CHANNELS = [
  { category: "sales_channels", key: "retail", value: { label: "Détail" }, custom: false },
];

const CREATED_SALE = {
  id: 1,
  farmId: 1,
  saleNumber: "V-0001",
  clientId: null,
  status: "COMPLETED",
  saleDate: "2026-07-18",
  paymentMethod: "CASH",
  totalXof: 0,
  notes: null,
  items: [],
};

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

let lastBody: Record<string, unknown> | null = null;
let lastMethod = "";

function setupFetch() {
  lastBody = null;
  lastMethod = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // RTK Query passes a Request object; extract the URL string.
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
      if (url.includes("poultry-batches")) return respond([BATCH, LAYER_BATCH]);
      if (url.includes("/breeds")) return respond(BREEDS);
      if (url.includes("tray-stock")) return respond(TRAY_STOCK);
      if (url.includes("catalog/sales_channels")) return respond(SALES_CHANNELS);
      if (url.includes("inventory/catalog/articles")) return respond(ARTICLES);
      if (url.includes("commercial/clients")) return respond([]);
      if (url.includes("commercial/sales") && lastMethod === "POST") return respond(CREATED_SALE);
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

  it("exclut les lots de ponte du sélecteur de chair (seuls les lots de chair vendent des têtes)", async () => {
    setup();
    // The broiler lot is offered…
    await screen.findByText("50 têtes restantes");
    // …but the layer lot (breed type "layer") is not shown as a meat lot.
    expect(screen.queryByText("Lot Pondeuse")).not.toBeInTheDocument();
    expect(screen.queryByText("30 têtes restantes")).not.toBeInTheDocument();
  });
});

describe("QuickSaleDialog — circuit de distribution", () => {
  beforeEach(() => {
    setupFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envoie salesChannelKey quand un circuit est sélectionné", async () => {
    const user = userEvent.setup();
    setup();

    // Add a line so the sale can be submitted.
    const lotCard = await screen.findByText("50 têtes restantes");
    const card = lotCard.closest("[role='button']") as HTMLElement;
    await user.click(card);

    // Wait for the channel catalog to load, then pick "Détail".
    const channelSelect = await screen.findByRole("combobox", { name: "Circuit (optionnel)" });
    await user.click(channelSelect);
    await user.click(await screen.findByRole("option", { name: "Détail" }));

    await user.click(screen.getByRole("button", { name: /Valider la vente/i }));

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastBody).toMatchObject({ salesChannelKey: "retail" });
  });

  it("n'envoie pas salesChannelKey quand aucun circuit n'est choisi", async () => {
    const user = userEvent.setup();
    setup();

    const lotCard = await screen.findByText("50 têtes restantes");
    const card = lotCard.closest("[role='button']") as HTMLElement;
    await user.click(card);

    // Let the channel catalog resolve without picking anything.
    await screen.findByRole("combobox", { name: "Circuit (optionnel)" });

    await user.click(screen.getByRole("button", { name: /Valider la vente/i }));

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastBody).not.toHaveProperty("salesChannelKey");
  });
});
