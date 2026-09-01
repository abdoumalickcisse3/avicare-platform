import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
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

function mockApi(over: { farms?: unknown[]; users?: unknown[]; codes?: unknown[]; allFarms?: unknown[] } = {}) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = input instanceof Request ? input.method : (init?.method ?? "GET");
      calls.push({ url, method });
      // /admin/farms (every farm, for the picker) and /partners/{id}/farms (this network's
      // memberships) both contain "/farms" — the partner-scoped one has to be matched first.
      const body = url.includes("/partners/") && url.includes("/farms")
        ? { data: over.farms ?? [membership()] }
        : url.includes("/admin/farms")
          ? { data: over.allFarms ?? [{ farmId: 42, name: "Ferme de Rosya", active: true, memberCount: 2, activeUnitCount: 3, lastActivityAt: null }] }
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

  it("names what the partner will see before attaching a farm", async () => {
    mockApi();
    renderWithProviders(<PartnerDetailPanel partnerId={1} />);

    await userEvent.click(await screen.findByRole("button", { name: /rattacher une ferme/i }));

    // Attaching confirms the membership at once and the sharing defaults are operational-ON. The
    // operator has to be told what starts flowing, not discover it from a farmer's complaint.
    expect(await screen.findByText(/santé du cheptel/i)).toBeInTheDocument();
    expect(screen.getByText(/consommation d'aliment/i)).toBeInTheDocument();
  });

  it("will not attach until a farm is picked and the farmer's request is stated", async () => {
    mockApi();
    renderWithProviders(<PartnerDetailPanel partnerId={1} />);

    await userEvent.click(await screen.findByRole("button", { name: /rattacher une ferme/i }));
    const confirm = screen.getByRole("button", { name: /^rattacher$/i });
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByRole("combobox", { name: /ferme/i }));
    await userEvent.click(await screen.findByRole("option", { name: /Ferme de Rosya/ }));
    // A farm is chosen, but nobody has said the farmer asked for it.
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox", { name: /l'éleveur m'a demandé/i }));
    expect(confirm).toBeEnabled();
  });

  it("hands over a temporary password when an account is created", async () => {
    const calls = mockApi();
    renderWithProviders(<PartnerDetailPanel partnerId={1} />);

    await userEvent.click(await screen.findByRole("button", { name: /créer un compte/i }));
    await userEvent.type(screen.getByLabelText(/email/i), "chef@sedima.sn");
    await userEvent.click(screen.getByRole("button", { name: /^créer$/i }));

    await waitFor(() =>
      expect(calls.some((c) => c.method === "POST" && c.url.includes("/users"))).toBe(true),
    );
  });

  it("does not call an invite code a one-off secret", async () => {
    mockApi();
    renderWithProviders(<PartnerDetailPanel partnerId={1} />);

    await userEvent.click(await screen.findByRole("button", { name: /générer un code/i }));

    // The same dialog reveals passwords, which really are shown once. A code stays listed below,
    // and saying otherwise teaches people to distrust the warning when it counts.
    expect(await screen.findByText(/code d'invitation/i)).toBeInTheDocument();
    expect(screen.queryByText(/affiché une seule fois/i)).toBeNull();
  });

  it("suspends the partner from the header", async () => {
    const calls = mockApi();
    renderWithProviders(<PartnerDetailPanel partnerId={1} />);

    await userEvent.click(await screen.findByRole("button", { name: /suspendre/i }));

    await waitFor(() =>
      expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/suspend"))).toBe(true),
    );
  });
});
