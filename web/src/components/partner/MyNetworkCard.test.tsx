import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { tokenStorage } from "@/lib/storage";
import MyNetworkCard from "./MyNetworkCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

function partner(over: Record<string, unknown> = {}) {
  return {
    membershipId: 1,
    partnerId: 3,
    partnerName: "Provende du Sahel",
    partnerType: "FEED_SUPPLIER",
    partnerLogoUrl: "https://cdn.example/sahel.png",
    status: "CONFIRMED",
    origin: "MANUAL_ADMIN",
    shareActivity: true,
    shareFlockHealth: true,
    shareFeedConsumption: true,
    shareSalesVolume: false,
    shareFinances: false,
    ...over,
  };
}

function mockPartners(data: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  tokenStorage.clear();
});

describe("MyNetworkCard", () => {
  it("shows the partner name and its logo", async () => {
    mockPartners([partner()]);
    renderWithProviders(<MyNetworkCard farmId={8} />);

    expect(await screen.findByText("Provende du Sahel")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Provende du Sahel" })).toHaveAttribute(
      "src",
      "https://cdn.example/sahel.png",
    );
  });

  it("falls back to the initial when the partner has no logo", async () => {
    mockPartners([partner({ partnerLogoUrl: null })]);
    renderWithProviders(<MyNetworkCard farmId={8} />);

    expect(await screen.findByText("Provende du Sahel")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("P")).toBeInTheDocument();
  });

  it("renders nothing when no partner is confirmed", async () => {
    // A declared-but-unconfirmed membership is not a network yet.
    mockPartners([partner({ status: "DECLARED" })]);
    const { container } = renderWithProviders(<MyNetworkCard farmId={8} />);

    // Nothing to co-brand: the card must not take up room on the dashboard.
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
