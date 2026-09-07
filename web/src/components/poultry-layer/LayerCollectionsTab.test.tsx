import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import type { ProductionUnit } from "@/types";

/**
 * Saisir une collecte est un geste de terrain (`poultry:write`, que porte un FARMER) ; la
 * supprimer est un geste de supervision, réservé OWNER/MANAGER côté backend
 * (`LayerAccess.WRITE_MANAGER`).
 *
 * La corbeille n'était gardée par rien du tout : elle s'affichait pour tout le monde, y compris
 * le vétérinaire, et répondait 403.
 */
let role = "OWNER";
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => role,
}));
// `poultry:write` accordé : c'est bien le rôle, et non la permission, qui doit décider.
vi.mock("@/hooks/useFarmPermissions", () => ({
  useFarmPermissions: () => ({ can: () => true }),
}));

import { LayerCollectionsTab } from "./LayerCollectionsTab";

const UNIT = {
  id: 12,
  farmId: 7,
  name: "Pondeuses A",
  unitType: "LAYER_FLOCK",
  status: "ACTIVE",
  startDate: "2026-06-01",
} as unknown as ProductionUnit;

const COLLECTION = {
  id: 5,
  unitId: 12,
  collectionDate: "2026-09-05",
  timeslotKey: "matin",
  totalEggs: 320,
  brokenEggs: 4,
  gradesCount: {},
};

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = input instanceof Request ? input.url : String(input);
      const data = url.includes("/collections") ? [COLLECTION] : [];
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

describe("LayerCollectionsTab — suppression d'une collecte", () => {
  it("est refusée à un ouvrier, malgré poultry:write", async () => {
    role = "FARMER";
    mockFetch();
    renderWithProviders(<LayerCollectionsTab farmId={7} unit={UNIT} />);

    // La collecte reste lisible : c'est la corbeille qui disparaît, pas la donnée.
    expect(await screen.findByText("matin")).toBeInTheDocument();
    expect(screen.queryByLabelText("Supprimer la collecte")).toBeNull();
  });

  it("est offerte au gérant", async () => {
    role = "MANAGER";
    mockFetch();
    renderWithProviders(<LayerCollectionsTab farmId={7} unit={UNIT} />);

    expect(await screen.findByLabelText("Supprimer la collecte")).toBeInTheDocument();
  });
});
