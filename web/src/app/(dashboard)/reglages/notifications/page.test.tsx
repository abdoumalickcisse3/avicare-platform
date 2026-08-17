import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import NotificationPreferencesPage from "./page";

vi.mock("@/hooks/useSelectedFarm", () => ({
  useSelectedFarm: () => ({ farmId: 7, isLoading: false, hasFarm: true }),
}));

const PREFS = [
  { category: "LOW_STOCK", channel: "IN_APP", enabled: true, minSeverity: "INFO" },
  { category: "LOW_STOCK", channel: "WHATSAPP", enabled: false, minSeverity: "CRITICAL" },
];

function mockFetch(onPut?: (url: string, method: string) => void) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
      if (method === "PUT") onPut?.(url, method);
      const body = method === "GET" ? { data: PREFS } : { data: null };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

describe("NotificationPreferencesPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the category grid from the API", async () => {
    mockFetch();
    renderWithProviders(<NotificationPreferencesPage />);
    expect(await screen.findByText("Stock bas")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
  });

  it("saves preferences via PUT", async () => {
    const put = vi.fn();
    mockFetch(put);
    renderWithProviders(<NotificationPreferencesPage />);
    await screen.findByText("Stock bas");
    await userEvent.click(screen.getByRole("button", { name: /enregistrer/i }));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/farms/7/notification-preferences"),
        "PUT",
      ),
    );
  });
});
