import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import ArticleLibraryPage from "./page";

vi.mock("@/hooks/useInventoryGating", () => ({
  useInventoryGating: () => ({ farmId: 1, hasFarm: true, hasInventory: true }),
}));
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => "OWNER",
}));

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
      if (url.includes("/inventory/catalog/articles")) {
        return respond([
          { articleKey: "feed_layer", articleSource: "INVENTORY", label: "Ponte", subcategory: "FEED", unit: "kg", typicalUnitPriceXof: 440, custom: false },
          { articleKey: "melange-maison", articleSource: "INVENTORY", label: "Mélange maison", subcategory: "FEED", unit: "sac", typicalUnitPriceXof: null, custom: true },
        ]);
      }
      return respond(null);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("ArticleLibraryPage", () => {
  it("enables create for OWNER and shows edit/delete only on custom rows", async () => {
    renderWithProviders(<ArticleLibraryPage />);

    expect(await screen.findByText("Mélange maison")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nouvel article/i })).toBeEnabled();

    // Custom row: "Perso" chip + a delete action.
    const customRow = screen.getByText("Mélange maison").closest("tr")!;
    expect(within(customRow).getByText("Perso")).toBeInTheDocument();
    expect(within(customRow).getByRole("button", { name: /Supprimer/i })).toBeInTheDocument();

    // Platform row: no delete action.
    const platformRow = screen.getByText("Ponte").closest("tr")!;
    expect(within(platformRow).queryByRole("button", { name: /Supprimer/i })).not.toBeInTheDocument();
  });
});
