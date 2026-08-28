import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { PartnerDetailPanel } from "./PartnerDetailPanel";

const PARTNER = {
  id: 2,
  name: "Provende du Sahel",
  type: "FEED_SUPPLIER",
  contactName: "Awa",
  contactPhone: "770000001",
  contactEmail: null,
  logoUrl: null,
  status: "ACTIVE",
};

function membership(over: Record<string, unknown> = {}) {
  return {
    id: 5,
    partnerId: 2,
    farmId: 8,
    status: "CONFIRMED",
    origin: "MANUAL_ADMIN",
    shareActivity: true,
    shareFlockHealth: true,
    shareFeedConsumption: true,
    shareSalesVolume: false,
    shareFinances: false,
    shareRestockForecast: false,
    ...over,
  };
}

function mockApi(over: { farms?: unknown[]; users?: unknown[]; codes?: unknown[] } = {}) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = input instanceof Request ? input.method : (init?.method ?? "GET");
      calls.push({ url, method });
      const body = url.includes("/farms")
        ? { data: over.farms ?? [membership()] }
        : url.includes("/users")
          ? { data: over.users ?? [] }
          : url.includes("/invite-codes")
            ? { data: over.codes ?? [] }
            : { data: PARTNER };
      return new Response(JSON.stringify(body), {
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

describe("PartnerDetailPanel", () => {
  it("shows all six consented sliders", async () => {
    mockApi();
    renderWithProviders(<PartnerDetailPanel partnerId={2} />);

    // Five out of six was the bug: the admin view must show the whole consent.
    expect(await screen.findByText("Activité")).toBeInTheDocument();
    expect(screen.getByText("Santé")).toBeInTheDocument();
    expect(screen.getByText("Aliment")).toBeInTheDocument();
    expect(screen.getByText("Ventes")).toBeInTheDocument();
    expect(screen.getByText("Finances")).toBeInTheDocument();
    expect(screen.getByText("Recommandes")).toBeInTheDocument();
  });

  it("requires a typed confirmation before detaching a farm", async () => {
    const calls = mockApi();
    renderWithProviders(<PartnerDetailPanel partnerId={2} />);

    await userEvent.click(await screen.findByRole("button", { name: /détacher/i }));

    const confirm = screen.getByRole("button", { name: "Détacher" });
    // Closing a third party's access must not be one click away in a table.
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText("confirmation"), "ferme 8");
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  });

  it("does not detach when the typed text does not match", async () => {
    const calls = mockApi();
    renderWithProviders(<PartnerDetailPanel partnerId={2} />);

    await userEvent.click(await screen.findByRole("button", { name: /détacher/i }));
    await userEvent.type(screen.getByLabelText("confirmation"), "ferme 9");

    expect(screen.getByRole("button", { name: "Détacher" })).toBeDisabled();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("says plainly when a partner has no login account", async () => {
    mockApi({ users: [] });
    renderWithProviders(<PartnerDetailPanel partnerId={2} />);

    // A partner with no account cannot use the portal at all — worth stating, not implying.
    expect(
      await screen.findByText(/ne peut pas se connecter au portail/),
    ).toBeInTheDocument();
  });

  it("shows how many memberships an invite code produced", async () => {
    mockApi({
      codes: [{ id: 3, partnerId: 2, code: "SAHEL2026", active: true, maxUses: null, usesCount: 4 }],
    });
    renderWithProviders(<PartnerDetailPanel partnerId={2} />);

    expect(await screen.findByText("SAHEL2026")).toBeInTheDocument();
    expect(screen.getByText(/4 adhésions/)).toBeInTheDocument();
  });
});
