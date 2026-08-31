import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { SecurityPanel } from "./SecurityPanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/securite",
}));

const AUTO_BLOCK = {
  ipAddress: "41.82.10.5",
  blockedAt: "2026-08-31T10:00:00",
  blockedUntil: "2026-08-31T11:00:00",
  minutesRemaining: 42,
  reason: "5 échecs de connexion en 15 min",
  blockedBy: "AUTO_BRUTEFORCE",
};

const EVENT = {
  id: 1,
  eventType: "BRUTEFORCE_DETECTED" as const,
  severity: "CRITICAL" as const,
  ipAddress: "41.82.10.5",
  email: "cible@jawdi.app",
  userAgent: "curl/8",
  details: {},
  actionTaken: "blocked",
  createdAt: "2026-08-31T10:00:00",
};

interface Call {
  url: string;
  method: string;
  body?: string;
}

function mockApi(blocked: unknown[] = [AUTO_BLOCK], events: unknown[] = [EVENT]) {
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
      return new Response(
        JSON.stringify({
          data: {
            counters: { critical: 1, failedLogins: 5, rateLimited: 2, blockedNow: blocked.length },
            events,
            blocked,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  adminTokenStorage.clear();
});

describe("SecurityPanel", () => {
  it("puts what is blocked before what merely happened", async () => {
    mockApi();
    renderWithProviders(<SecurityPanel />);

    expect(await screen.findByText("5 échecs de connexion en 15 min")).toBeInTheDocument();
    expect(screen.getByText("42 min")).toBeInTheDocument();
    // An automatic block says so rather than naming a person who did not decide it.
    expect(screen.getByText("automatique")).toBeInTheDocument();
  });

  it("says plainly when nobody is blocked", async () => {
    mockApi([], []);
    renderWithProviders(<SecurityPanel />);

    expect(await screen.findByText(/aucune adresse bloquée/i)).toBeInTheDocument();
  });

  it("warns about intrusions on the period", async () => {
    mockApi();
    renderWithProviders(<SecurityPanel />);

    expect(await screen.findByText(/1 tentative\(s\) d'intrusion/i)).toBeInTheDocument();
  });

  it("needs an address and a reason before blocking one", async () => {
    mockApi();
    renderWithProviders(<SecurityPanel />);

    await userEvent.click(await screen.findByRole("button", { name: /bloquer une adresse/i }));
    const confirm = screen.getByRole("button", { name: /^bloquer$/i });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/adresse ip/i), "203.0.113.9");
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/raison/i), "scraping");
    expect(confirm).toBeEnabled();
  });

  it("releases an address with a reason attached", async () => {
    const calls = mockApi();
    renderWithProviders(<SecurityPanel />);

    // The address shows twice — in the blocked list and again in the log below it. The first is
    // the actionable one.
    const row = (await screen.findAllByText("41.82.10.5"))[0].closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: /débloquer/i }));
    await userEvent.type(screen.getByLabelText(/raison/i), "faux positif");
    await userEvent.click(screen.getByRole("button", { name: /^débloquer$/i }));

    await waitFor(() => {
      const call = calls.find((c) => c.method === "POST" && c.url.includes("/unblock"));
      expect(call?.body).toContain("faux positif");
    });
  });

  it("changes the window on demand", async () => {
    const calls = mockApi();
    renderWithProviders(<SecurityPanel />);
    await screen.findAllByText("41.82.10.5");

    await userEvent.click(screen.getByRole("button", { name: "24 h" }));

    await waitFor(() => expect(calls.some((c) => c.url.includes("days=1"))).toBe(true));
  });
});
