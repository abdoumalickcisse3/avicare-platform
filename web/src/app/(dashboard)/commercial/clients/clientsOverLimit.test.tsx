import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";

/**
 * L'encours d'un client est indicatif et jamais bloquant (D26) : la seule chose que l'application
 * doit faire, c'est le rendre visible. Le ratio était affiché ligne par ligne, sans moyen de
 * filtrer dessus — sur cinquante clients, repérer les trois qui débordent demandait de tous les
 * lire.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/hooks/useCommercialGating", () => ({
  useCommercialGating: () => ({ farmId: 7, hasFarm: true, hasCommercial: true, isLoading: false }),
}));
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => "OWNER",
}));

import ClientsPage from "./page";

const CLIENTS = [
  // Au-dessus de sa limite : 150 000 dus pour 100 000 accordés.
  { id: 1, farmId: 7, displayName: "Awa Diop", phone: null, email: null, address: null, city: null, clientType: "RETAIL", creditLimitXof: 100000, currentBalanceXof: 150000, active: true, notes: null },
  // Débiteur, mais dans sa limite.
  { id: 2, farmId: 7, displayName: "Moussa Fall", phone: null, email: null, address: null, city: null, clientType: "RETAIL", creditLimitXof: 500000, currentBalanceXof: 50000, active: true, notes: null },
  // Sans limite fixée : jamais « dépassé », on ne peut pas dépasser ce qui n'existe pas.
  { id: 3, farmId: 7, displayName: "Fatou Sow", phone: null, email: null, address: null, city: null, clientType: "WHOLESALE", creditLimitXof: null, currentBalanceXof: 900000, active: true, notes: null },
];

function mockFetch(clients: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ data: clients }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("Clients — encours dépassé", () => {
  it("ne retient que les clients au-dessus d'une limite réellement fixée", async () => {
    mockFetch(CLIENTS);
    renderWithProviders(<ClientsPage />);

    await userEvent.click(await screen.findByRole("tab", { name: "Encours dépassé (1)" }));

    expect(screen.getByText("Awa Diop")).toBeInTheDocument();
    // Débiteur mais dans sa limite.
    expect(screen.queryByText("Moussa Fall")).toBeNull();
    // Gros encours, mais aucune limite fixée : rien à dépasser.
    expect(screen.queryByText("Fatou Sow")).toBeNull();
  });

  it("ne montre pas l'onglet quand personne ne déborde", async () => {
    mockFetch([CLIENTS[1], CLIENTS[2]]);
    renderWithProviders(<ClientsPage />);

    expect(await screen.findByText("Moussa Fall")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Encours dépassé/ })).toBeNull();
  });
});
