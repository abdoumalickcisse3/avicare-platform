import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { CatalogCategoryView } from "./CatalogCategoryView";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/catalog/")) return respond([]);
      if (url.includes("/api/v1/farms")) return respond([{ id: 1, name: "Ferme" }]);
      return respond([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("CatalogCategoryView", () => {
  it("renders the manager for a configured slug", async () => {
    renderWithProviders(<CatalogCategoryView slug="lots" />);
    expect(await screen.findByText("Souches et races de volaille (chair, ponte).")).toBeInTheDocument();
  });
  it("renders a coming-soon placeholder for an unconfigured slug", () => {
    renderWithProviders(<CatalogCategoryView slug="ventes" />);
    expect(screen.getByText(/Bientôt disponible/i)).toBeInTheDocument();
  });
});
