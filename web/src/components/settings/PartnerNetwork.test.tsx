import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { setTokens } from "@/store/slices/authSlice";
import PartnerNetwork from "./PartnerNetwork";

function makeJwt(payload: unknown): string {
  const b64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `h.${b64}.s`;
}

function ownerToken() {
  return makeJwt({ memberships: [{ farmId: 42, farmRole: "OWNER", permissions: ["*"] }] });
}

function mockFetch(data: unknown) {
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

beforeEach(() => mockFetch([]));
afterEach(() => vi.unstubAllGlobals());

function membership(over: Record<string, unknown> = {}) {
  return {
    membershipId: 5,
    partnerId: 3,
    partnerName: "Provende du Sahel",
    partnerType: "FEED_SUPPLIER",
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

describe("PartnerNetwork", () => {
  it("shows the empty state with join + browse actions for an owner", async () => {
    const { store } = renderWithProviders(<PartnerNetwork farmId={42} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));

    expect(await screen.findByText(/aucun réseau/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rejoindre par code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /parcourir les partenaires/i })).toBeInTheDocument();
  });

  it("shows the restock forecast slider off on an existing membership", async () => {
    mockFetch([membership()]);
    const { store } = renderWithProviders(<PartnerNetwork farmId={42} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));

    expect(await screen.findByText("Prévisions de recommande")).toBeInTheDocument();
    // No retroactive consent: a membership that predates the slider starts opted out.
    expect(screen.getByLabelText("5 restockForecast")).not.toBeChecked();
    // …while the operational sliders it did consent to stay on.
    expect(screen.getByLabelText("5 activity")).toBeChecked();
  });

  it("reflects an opted-in membership", async () => {
    mockFetch([membership({ shareRestockForecast: true })]);
    const { store } = renderWithProviders(<PartnerNetwork farmId={42} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));

    expect(await screen.findByLabelText("5 restockForecast")).toBeChecked();
  });
});
