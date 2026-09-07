import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { formatCurrency } from "@/lib/format";
import SuppliersPage from "./page";

// Les écritures fournisseur sont OWNER/MANAGER côté serveur : sans rôle, rien n'est offert.
let role = "OWNER";
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => role,
}));
vi.mock("@/hooks/useInventoryGating", () => ({
  useInventoryGating: () => ({ farmId: 7, hasFarm: true, hasInventory: true }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const SUPPLIERS = [
  {
    id: 1,
    farmId: 7,
    commercialName: "Provende du Sahel",
    contactPerson: null,
    phone: "770001122",
    email: null,
    address: null,
    city: null,
    types: [],
    paymentTerms: null,
    notes: null,
    active: true,
    notifyWhatsapp: true,
  },
  {
    id: 2,
    farmId: 7,
    commercialName: "Compte soldé",
    contactPerson: null,
    phone: null,
    email: null,
    address: null,
    city: null,
    types: [],
    paymentTerms: null,
    notes: null,
    active: true,
    notifyWhatsapp: false,
  },
];

const BALANCES = [
  { supplierId: 1, supplierName: "Provende du Sahel", balanceXof: 150000 },
  { supplierId: 2, supplierName: "Compte soldé", balanceXof: 0 },
];

function respond(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } }),
  );
}

/**
 * RTK Query hands `fetch` a `Request` object (not a plain URL + init), so a PUT body must be
 * read via `input.clone().text()` — `init.body` is empty in that shape.
 */
function mockFetch(opts?: { onPut?: (url: string, body: Record<string, unknown>) => void }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
      if (method === "PUT") {
        const rawBody = input instanceof Request ? await input.clone().text() : String(init?.body ?? "");
        const body = rawBody ? JSON.parse(rawBody) : {};
        opts?.onPut?.(url, body);
        return respond(SUPPLIERS[0]);
      }
      if (url.includes("/balances")) return respond(BALANCES);
      return respond(SUPPLIERS);
    }),
  );
}

// Intl currency formatting inserts non-breaking / narrow-no-break spaces; normalize whitespace
// on both sides before matching so the query isn't defeated by those characters.
function findByFormattedCurrency(amount: number) {
  const target = formatCurrency(amount).replace(/\s+/g, " ");
  return screen.findByText((content) => content.replace(/\s+/g, " ") === target);
}

afterEach(() => vi.unstubAllGlobals());

describe("SuppliersPage", () => {
  it("shows each supplier's balance, a zero balance as an em dash", async () => {
    mockFetch();
    renderWithProviders(<SuppliersPage />);

    expect(await screen.findByText("Provende du Sahel")).toBeInTheDocument();
    expect(await findByFormattedCurrency(150000)).toBeInTheDocument();

    const soldeCard = screen.getByText("Compte soldé").closest(".MuiCard-root")!;
    expect(soldeCard).toHaveTextContent("—");
  });

  it("resends notifyWhatsapp: true on save when only another field changed", async () => {
    const put = vi.fn();
    mockFetch({ onPut: put });
    renderWithProviders(<SuppliersPage />);

    await screen.findByText("Provende du Sahel");

    const actionButtons = screen.getAllByRole("button", { name: "Actions" });
    await userEvent.click(actionButtons[0]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Modifier" }));

    await userEvent.type(await screen.findByLabelText("Personne contact"), "Nouveau contact");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await vi.waitFor(() => expect(put).toHaveBeenCalled());
    const [url, body] = put.mock.calls[0];
    expect(url).toContain("/inventory/suppliers/1");
    expect(body.notifyWhatsapp).toBe(true);
  });

  it("n'offre aucune action d'écriture à un ouvrier", async () => {
    // `InventoryAccess.WRITE_MANAGER` : créer, éditer et supprimer un fournisseur sont
    // réservés au propriétaire et au gérant. La liste, elle, reste lisible.
    role = "FARMER";
    try {
      mockFetch();
      renderWithProviders(<SuppliersPage />);

      expect(await screen.findByText("Provende du Sahel")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Actions" })).toBeNull();
      expect(screen.queryByRole("button", { name: /Nouveau fournisseur/ })).toBeNull();
    } finally {
      role = "OWNER";
    }
  });
});
