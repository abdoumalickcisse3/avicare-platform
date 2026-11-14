import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { setTokens } from "@/store/slices/authSlice";
import { CatalogManager } from "./CatalogManager";
import { getCategoryConfig, type CategoryConfig } from "@/constants/catalogCategories";

// Décor local plutôt qu'une vraie catégorie : ces tests portent sur le composant, pas sur le
// contenu du catalogue, et les attacher à une catégorie réelle les cassait dès qu'elle bougeait.
const LOTS: CategoryConfig = {
  slug: "essai",
  backendCategory: "essai_items",
  title: "Essai",
  description: "Décor de test.",
  labelField: "label",
  fields: [
    { name: "label", label: "Nom", type: "text", required: true },
    {
      name: "type",
      label: "Type",
      type: "select",
      required: true,
      options: [
        { value: "broiler", label: "Chair" },
        { value: "layer", label: "Ponte" },
      ],
    },
    { name: "species", label: "Espèce", type: "text", const: "poultry" },
  ],
};

function makeJwt(payload: unknown): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `h.${b64}.s`;
}
function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}
let lastMethod = "";
beforeEach(() => {
  lastMethod = "";
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    lastMethod = input instanceof Request ? input.method : (init?.method ?? "GET");
    if (lastMethod === "DELETE") return new Response(null, { status: 204 });
    return respond([
      { category: "essai_items", key: "cobb_500", value: { label: "Cobb 500", type: "broiler" }, custom: false },
      { category: "essai_items", key: "ma-race", value: { label: "Ma Race", type: "layer" }, custom: true },
    ]);
  }));
});
afterEach(() => vi.unstubAllGlobals());

function ownerToken() {
  return makeJwt({ memberships: [{ farmId: 1, farmRole: "OWNER", permissions: ["*"] }] });
}

describe("CatalogManager", () => {
  it("lists entries with a platform/custom badge", async () => {
    const { store } = renderWithProviders(<CatalogManager config={LOTS} farmId={1} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));
    const cobbRow = (await screen.findByText("Cobb 500")).closest("tr")!;
    const maRow = screen.getByText("Ma Race").closest("tr")!;
    expect(within(cobbRow).getByText("Plateforme")).toBeInTheDocument();
    expect(within(maRow).getByText("Personnalisé")).toBeInTheDocument();
  });

  it("labels the row action Désactiver for a platform entry and Supprimer for a custom one", async () => {
    const { store } = renderWithProviders(<CatalogManager config={LOTS} farmId={1} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));
    await screen.findByText("Cobb 500");
    expect(screen.getByRole("button", { name: /Désactiver Cobb 500/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Supprimer Ma Race/i })).toBeInTheDocument();
  });

  it("hides write actions when the user cannot manage the catalog (no role)", async () => {
    renderWithProviders(<CatalogManager config={LOTS} farmId={1} />); // no token → role null
    await screen.findByText("Cobb 500");
    expect(screen.queryByRole("button", { name: /Ajouter/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Modifier Cobb 500/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Désactiver Cobb 500/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Supprimer Ma Race/i })).not.toBeInTheDocument();
  });
});
