import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { FarmIdentityCard } from "./FarmIdentityCard";

const FARM = {
  id: 1,
  name: "Ferme Complète",
  description: null,
  location: "Thiès",
  gpsLatitude: null,
  gpsLongitude: null,
  capacity: null,
  timezone: null,
  currency: "XOF",
  createdBy: 1,
  active: true,
  createdAt: "2026-01-01T00:00:00",
  productionFocus: [],
  ninea: "008492019 2V2",
  rccm: null,
  logoUpdatedAt: null as string | null,
};

/** Sert la ferme, et l'image du logo en binaire quand elle est demandée. */
function mockFetch(farm: typeof FARM) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.endsWith("/logo")) {
      // Quelques octets de signature PNG — on ne teste pas le décodage de
      // l'image, on teste que les octets arrivent jusqu'au `src` de la balise.
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }
    return new Response(JSON.stringify({ data: farm }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("FarmIdentityCard", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("propose d'ajouter un logo quand la ferme n'en a pas", async () => {
    mockFetch(FARM);
    renderWithProviders(<FarmIdentityCard farmId={1} />);

    expect(await screen.findByText("Aucun logo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ajouter un logo/i })).toBeInTheDocument();
    // Rien à retirer tant qu'il n'y a rien.
    expect(screen.queryByRole("button", { name: /retirer/i })).not.toBeInTheDocument();
  });

  it("affiche le logo et propose de le remplacer quand la ferme en a un", async () => {
    mockFetch({ ...FARM, logoUpdatedAt: "2026-10-13T02:00:00" });
    renderWithProviders(<FarmIdentityCard farmId={1} />);

    expect(await screen.findByRole("img", { name: /logo de ferme complète/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remplacer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retirer/i })).toBeInTheDocument();
  });

  it("reprend le NINEA déjà enregistré", async () => {
    mockFetch(FARM);
    renderWithProviders(<FarmIdentityCard farmId={1} />);

    expect(await screen.findByDisplayValue("008492019 2V2")).toBeInTheDocument();
  });

  it("refuse un fichier trop lourd sans rien envoyer au serveur", async () => {
    const fetchMock = mockFetch(FARM);
    renderWithProviders(<FarmIdentityCard farmId={1} />);
    await screen.findByText("Aucun logo");

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const heavy = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "gros.png", {
      type: "image/png",
    });
    await userEvent.upload(input, heavy);

    expect(await screen.findByText(/ne doit pas dépasser 2 Mo/i)).toBeInTheDocument();
    // Le refus est local : prévenir vaut mieux qu'un aller-retour sur une
    // connexion lente pour s'entendre dire non.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/logo") && u !== undefined),
      ).toHaveLength(0),
    );
  });

  it("refuse un type que la facture ne sait pas imprimer", async () => {
    mockFetch(FARM);
    renderWithProviders(<FarmIdentityCard farmId={1} />);
    await screen.findByText("Aucun logo");

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(["x"], "logo.gif", { type: "image/gif" }));

    expect(await screen.findByText(/PNG ou JPEG/i)).toBeInTheDocument();
  });
});
