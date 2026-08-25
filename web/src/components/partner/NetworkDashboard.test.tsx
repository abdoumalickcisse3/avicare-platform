import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { partnerTokenStorage } from "@/lib/partnerStorage";
import NetworkDashboard from "./NetworkDashboard";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
}));

const ME = { partnerId: 1, name: "Provende du Sahel", type: "FEED_SUPPLIER", logoUrl: null, farmCount: 2 };
const NETWORK = { farmCount: 2, activeFarmCount: 1, totalFeedKg: 1500, avgMortalityRate: null };
const FARMS = [
  { farmId: 1, farmName: "Ferme A", active: true, feedKg: 1500, mortalityRate: null, riskLevel: "AT_RISK" },
  { farmId: 2, farmName: "Ferme B", active: null, feedKg: null, mortalityRate: 2.5, riskLevel: null },
];
const ALERTS = [
  {
    id: 7,
    farmId: 1,
    category: "FARM_SILENT",
    severity: "WARNING",
    title: "Éleveur silencieux : Ferme A",
    body: "« Ferme A » n'a rien saisi depuis 20 jours.",
    createdAt: "2026-08-25T06:30:00",
  },
];

/** Route the three portal GETs by url; anything else answers an empty envelope. */
function mockNetworkFetch(farms: unknown = FARMS, alerts: unknown = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      const body = url.includes("/network/farms")
        ? { data: farms }
        : url.includes("/network/alerts")
          ? { data: alerts }
          : url.includes("/network")
            ? { data: NETWORK }
            : { data: ME };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

beforeEach(() => {
  replace.mockClear();
  partnerTokenStorage.set("ptoken", "pref");
});
afterEach(() => {
  vi.unstubAllGlobals();
  partnerTokenStorage.clear();
});

describe("NetworkDashboard", () => {
  it("renders the partner header, KPIs and the farms table", async () => {
    mockNetworkFetch();
    renderWithProviders(<NetworkDashboard />);

    expect(await screen.findByText("Provende du Sahel")).toBeInTheDocument();
    expect(screen.getByText("Provendier")).toBeInTheDocument();
    // 1500 → fr-FR groups with a narrow no-break space; shown in the KPI and in the row
    expect(await screen.findAllByText(/^1\s500$/)).toHaveLength(2);
    expect(await screen.findByText("Ferme A")).toBeInTheDocument();
    expect(screen.getByText("Ferme B")).toBeInTheDocument();
  });

  it("masks metrics the farm does not share with a dash", async () => {
    mockNetworkFetch();
    renderWithProviders(<NetworkDashboard />);

    const rowB = (await screen.findByText("Ferme B")).closest("tr")!;
    // active + riskLevel + feedKg are null (not shared) → dashes; mortality is shared → percent
    expect(within(rowB).getAllByText("—")).toHaveLength(3);
    expect(within(rowB).getByText("2.5 %")).toBeInTheDocument();
  });

  it("shows the follow-up level of a farm that shares its activity", async () => {
    mockNetworkFetch();
    renderWithProviders(<NetworkDashboard />);

    const rowA = (await screen.findByText("Ferme A")).closest("tr")!;
    expect(within(rowA).getByText("À risque")).toBeInTheDocument();
  });

  it("renders no alert banner when the network is quiet", async () => {
    mockNetworkFetch(FARMS, []);
    renderWithProviders(<NetworkDashboard />);

    // An empty "no alerts" panel would be noise on a screen opened every week.
    await screen.findByText("Ferme A");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("surfaces open alerts above the dashboard", async () => {
    mockNetworkFetch(FARMS, ALERTS);
    renderWithProviders(<NetworkDashboard />);

    expect(await screen.findByText("Éleveur silencieux : Ferme A")).toBeInTheDocument();
    expect(screen.getByText(/n'a rien saisi depuis 20 jours/)).toBeInTheDocument();
  });

  it("shows an empty state when the network has no farm", async () => {
    mockNetworkFetch([]);
    renderWithProviders(<NetworkDashboard />);

    expect(await screen.findByText("Aucune ferme dans votre réseau.")).toBeInTheDocument();
  });
});
