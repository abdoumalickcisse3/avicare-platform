import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import LayerSettingsPage from "./page";

vi.mock("@/hooks/useSelectedFarm", () => ({
  useSelectedFarm: () => ({ farmId: 7, isLoading: false, hasFarm: true }),
}));

const roleMock = vi.fn(() => "OWNER");
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => roleMock(),
}));

const TRAY = { traySize: 30, trayPriceXof: 2500 };

function mockFetch(onPut?: (url: string, body: string) => void) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
      if (method === "PUT") {
        // RTK Query hands fetch a Request, so the body is on it and not on `init`.
        const body =
          input instanceof Request ? await input.clone().text() : String(init?.body ?? "");
        onPut?.(url, body);
        return new Response(JSON.stringify({ data: { key: "x", value: "1" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const data = url.includes("tray-settings") ? TRAY : [];
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

describe("LayerSettingsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    roleMock.mockReturnValue("OWNER");
  });

  it("saves both tray settings, one key per call", async () => {
    const put = vi.fn();
    mockFetch(put);
    renderWithProviders(<LayerSettingsPage />);

    const size = await screen.findByLabelText("Taille d'un plateau");
    await waitFor(() => expect(size).toHaveValue("30"));

    await userEvent.clear(size);
    await userEvent.type(size, "12");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect(put.mock.calls[0][0]).toContain("/api/v1/farms/7/settings/tray_size");
    expect(put.mock.calls[0][1]).toContain('"12"');
    expect(put.mock.calls[1][0]).toContain("/api/v1/farms/7/settings/tray_price_xof");
  });

  it("stays read-only for a member who is not OWNER or MANAGER", async () => {
    roleMock.mockReturnValue("FARMER");
    mockFetch();
    renderWithProviders(<LayerSettingsPage />);

    expect(await screen.findByText("30 œufs")).toBeInTheDocument();
    expect(screen.queryByLabelText("Taille d'un plateau")).toBeNull();
  });
});
