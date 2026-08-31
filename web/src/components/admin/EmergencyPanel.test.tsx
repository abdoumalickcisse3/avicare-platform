import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { EmergencyPanel } from "./EmergencyPanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/urgence",
}));

const CALM = {
  flagKey: "module.inventory",
  enabledGlobally: true,
  killswitchActive: false,
  killswitchReason: null,
  killswitchBy: null,
  killswitchAt: null,
  killswitchExpiresAt: null,
  secondsRemaining: null,
};

const CUT = {
  ...CALM,
  flagKey: "module.finance",
  killswitchActive: true,
  killswitchReason: "factures en double",
  killswitchBy: 3,
  killswitchAt: "2026-08-31T06:00:00",
  killswitchExpiresAt: "2026-08-31T06:30:00",
  secondsRemaining: 754,
};

const HISTORY = [
  {
    action: "killswitch.expire",
    flagKey: "module.inventory",
    reason: null,
    actorUserId: null,
    at: "2026-08-31T05:00:00",
  },
];

interface Call {
  url: string;
  method: string;
  body?: string;
}

function mockApi(flags: unknown[] = [CALM]) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const url = request ? request.url : String(input);
      calls.push({
        url,
        method: request ? request.method : (init?.method ?? "GET"),
        body: request ? await request.clone().text() : (init?.body as string | undefined),
      });
      const payload = url.includes("/flags/history") ? HISTORY : flags;
      return new Response(JSON.stringify({ data: payload }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  adminTokenStorage.clear();
});

describe("EmergencyPanel", () => {
  it("lists the switches with their key", async () => {
    mockApi();
    renderWithProviders(<EmergencyPanel />);

    // Twice on purpose: once as a switch in the table, once in the history line below it.
    expect(await screen.findAllByText("Stocks")).toHaveLength(2);
    expect(screen.getByText("module.inventory")).toBeInTheDocument();
  });

  it("keeps the cut button disabled until a reason is written", async () => {
    mockApi();
    renderWithProviders(<EmergencyPanel />);

    await userEvent.click(await screen.findByRole("button", { name: /couper/i }));

    const confirm = screen.getByRole("button", { name: /couper maintenant/i });
    expect(confirm).toBeDisabled();

    // Whitespace is not a reason: whoever finds the platform cut at 3am needs an actual sentence.
    await userEvent.type(screen.getByLabelText(/raison/i), "   ");
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/raison/i), "comptage faux");
    expect(confirm).toBeEnabled();
  });

  it("sends the reason with the cut", async () => {
    const calls = mockApi();
    renderWithProviders(<EmergencyPanel />);

    await userEvent.click(await screen.findByRole("button", { name: /couper/i }));
    await userEvent.type(screen.getByLabelText(/raison/i), "comptage faux");
    await userEvent.click(screen.getByRole("button", { name: /couper maintenant/i }));

    await waitFor(() => {
      const cut = calls.find((c) => c.url.includes("/killswitch") && c.method === "POST");
      expect(cut?.body).toContain("comptage faux");
    });
  });

  it("shows what is cut, why, and how long is left", async () => {
    mockApi([CUT]);
    renderWithProviders(<EmergencyPanel />);

    expect(await screen.findByText(/1 fonctionnalité est actuellement coupée/i)).toBeInTheDocument();
    expect(screen.getByText("factures en double")).toBeInTheDocument();
    // 754s = 12:34 left before it lifts itself.
    expect(screen.getByText("12:34")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /prolonger/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lever/i })).toBeInTheDocument();
  });

  it("lifts a cut without asking for a reason", async () => {
    const calls = mockApi([CUT]);
    renderWithProviders(<EmergencyPanel />);

    await userEvent.click(await screen.findByRole("button", { name: /lever/i }));

    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("/killswitch/lift") && c.method === "POST")).toBe(true),
    );
  });

  it("marks what the platform did on its own", async () => {
    mockApi();
    renderWithProviders(<EmergencyPanel />);

    const history = await screen.findByText("Expiration automatique");
    expect(history).toBeInTheDocument();
    expect(screen.getByText("automatique")).toBeInTheDocument();
  });

  it("toggles the standing switch straight from the row", async () => {
    const calls = mockApi();
    renderWithProviders(<EmergencyPanel />);

    await userEvent.click(await screen.findByLabelText(/servir stocks/i));

    await waitFor(() => {
      const put = calls.find((c) => c.method === "PUT");
      expect(put?.body).toContain("false");
    });
  });
});
