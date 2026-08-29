import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { CommunicationPanel } from "./CommunicationPanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/communication",
}));

const DRAFT = {
  id: 1,
  title: "Brouillon",
  body: "Corps",
  severity: "INFO" as const,
  startsAt: "2026-08-29T00:00:00",
  endsAt: null,
  published: false,
};
const LIVE = {
  id: 2,
  title: "En cours",
  body: "Corps",
  severity: "WARNING" as const,
  startsAt: "2026-08-01T00:00:00",
  endsAt: null,
  published: true,
};
const EXPIRED = {
  id: 3,
  title: "Terminée",
  body: "Corps",
  severity: "INFO" as const,
  startsAt: "2026-07-01T00:00:00",
  endsAt: "2026-07-10T00:00:00",
  published: true,
};

interface Call {
  url: string;
  method: string;
  body?: string;
}

function mockApi(announcements: unknown[] = [DRAFT, LIVE, EXPIRED], count = 12) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    // fetchBaseQuery hands fetch a Request, not (url, init).
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const url = request ? request.url : String(input);
      calls.push({
        url,
        method: request ? request.method : (init?.method ?? "GET"),
        body: request ? await request.clone().text() : (init?.body as string | undefined),
      });
      const payload = url.includes("/broadcast/recipients")
        ? { count }
        : url.includes("/broadcast")
          ? { queued: count }
          : announcements;
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

describe("CommunicationPanel", () => {
  it("tells a live announcement apart from a scheduled one and an expired one", async () => {
    mockApi();
    renderWithProviders(<CommunicationPanel />);

    const live = (await screen.findByText("En cours")).closest("tr") as HTMLElement;
    expect(within(live).getByText("visible")).toBeInTheDocument();

    const draft = screen.getByText("Brouillon").closest("tr") as HTMLElement;
    expect(within(draft).getByText("brouillon")).toBeInTheDocument();

    // Published but past its end date: no longer visible, and saying "visible" would be a lie.
    const expired = screen.getByText("Terminée").closest("tr") as HTMLElement;
    expect(within(expired).getByText("programmée")).toBeInTheDocument();
  });

  it("warns when an announcement has no end date", async () => {
    mockApi();
    renderWithProviders(<CommunicationPanel />);

    await userEvent.click(await screen.findByRole("button", { name: /nouvelle annonce/i }));

    // An announcement that cannot expire is one somebody has to remember to take down.
    expect(screen.getByText(/jusqu'à ce que quelqu'un pense à la retirer/)).toBeInTheDocument();
  });

  it("shows the recipient count before any campaign is sent", async () => {
    mockApi();
    renderWithProviders(<CommunicationPanel />);

    // The cost has to be visible before the click, not after.
    expect(await screen.findByText(/12 personne\(s\)/)).toBeInTheDocument();
  });

  it("asks for confirmation before spending credits", async () => {
    const calls = mockApi();
    renderWithProviders(<CommunicationPanel />);

    await userEvent.type(await screen.findByLabelText("Message"), "Coupure samedi");
    await userEvent.click(screen.getByRole("button", { name: /^envoyer$/i }));

    expect(await screen.findByText(/Un message parti ne se rappelle pas/)).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("sends the campaign once confirmed", async () => {
    const calls = mockApi();
    renderWithProviders(<CommunicationPanel />);

    await userEvent.type(await screen.findByLabelText("Message"), "Coupure samedi");
    await userEvent.click(screen.getByRole("button", { name: /^envoyer$/i }));
    await userEvent.click(await screen.findByRole("button", { name: /envoyer maintenant/i }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST")!;
    expect(JSON.parse(post.body as string)).toEqual({
      message: "Coupure samedi",
      farmIds: [],
    });
  });

  it("keeps the send button out of reach while the message is empty", async () => {
    mockApi();
    renderWithProviders(<CommunicationPanel />);

    expect(await screen.findByRole("button", { name: /^envoyer$/i })).toBeDisabled();
  });
});
