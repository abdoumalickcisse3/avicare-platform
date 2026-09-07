import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/useInventoryGating", () => ({
  useInventoryGating: () => ({ farmId: 7, hasFarm: true, hasInventory: true, isLoading: false }),
}));

// Le backend garde sur le rôle, pas sur la permission.
let role = "OWNER";
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => role,
}));

// The chart pulls in a ResizeObserver-dependent tree that adds nothing to these assertions.
vi.mock("./StockHistoryChart", () => ({ StockHistoryChart: () => null }));

import { StockItemDetailView } from "./StockItemDetailView";

const ITEM = {
  id: 4,
  farmId: 7,
  articleKey: "MAIS",
  articleSource: "INVENTORY",
  unit: "kg",
  currentQuantity: 120,
  alertThreshold: 200,
  typicalUnitPriceXof: 300,
  notes: null,
  active: true,
};

/** `onWrite` receives the URL and method of any non-GET request. */
function mockFetch(opts?: {
  item?: Partial<typeof ITEM>;
  onWrite?: (url: string, method: string) => void;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
      if (method !== "GET") {
        opts?.onWrite?.(url, method);
        return new Response(JSON.stringify({ data: { ...ITEM, ...opts?.item } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const data = url.includes("/movements") ? [] : { ...ITEM, ...opts?.item };
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

describe("StockItemDetailView", () => {
  it("laisse régler le seuil d'alerte, que la page ne faisait qu'afficher", async () => {
    const writes: { url: string; method: string }[] = [];
    mockFetch({ onWrite: (url, method) => writes.push({ url, method }) });
    renderWithProviders(<StockItemDetailView stockItemId={4} />);

    await userEvent.click(await screen.findByLabelText("Modifier le seuil d'alerte"));
    const field = await screen.findByLabelText("Alerter en dessous de");
    await userEvent.clear(field);
    await userEvent.type(field, "300");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(writes.some((w) => w.url.includes("/threshold") && w.method === "PUT")).toBe(true);
  });

  it("avertit sans refuser un seuil déjà au-dessus du stock", async () => {
    // D19 : l'éleveur reste maître de son inventaire — c'est une façon légitime de dire
    // « je suis déjà à court », et l'alerte doit se lever tout de suite.
    mockFetch();
    renderWithProviders(<StockItemDetailView stockItemId={4} />);

    await userEvent.click(await screen.findByLabelText("Modifier le seuil d'alerte"));
    const field = await screen.findByLabelText("Alerter en dessous de");
    await userEvent.clear(field);
    await userEvent.type(field, "500");

    expect(screen.getByText(/l'alerte se déclenchera tout de suite/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
  });

  it("dit que l'archivage n'efface rien avant de le faire", async () => {
    const writes: { url: string; method: string }[] = [];
    mockFetch({ onWrite: (url, method) => writes.push({ url, method }) });
    renderWithProviders(<StockItemDetailView stockItemId={4} />);

    await userEvent.click(await screen.findByRole("button", { name: "Archiver cet article" }));
    expect(screen.getByText(/Son historique reste consultable/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Archiver" }));
    expect(writes.some((w) => w.url.includes("/deactivate") && w.method === "POST")).toBe(true);
  });

  it("n'offre ni le seuil ni l'archivage à un ouvrier", async () => {
    // Le backend répond 403 : cacher plutôt que proposer un geste qui échouera.
    role = "FARMER";
    mockFetch();
    renderWithProviders(<StockItemDetailView stockItemId={4} />);

    expect(await screen.findByText("Seuil d'alerte")).toBeInTheDocument();
    expect(screen.queryByLabelText("Modifier le seuil d'alerte")).toBeNull();
    expect(screen.queryByRole("button", { name: "Archiver cet article" })).toBeNull();
  });
});
