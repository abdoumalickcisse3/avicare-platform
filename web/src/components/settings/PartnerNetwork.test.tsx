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

describe("PartnerNetwork", () => {
  it("shows the empty state with join + browse actions for an owner", async () => {
    const { store } = renderWithProviders(<PartnerNetwork farmId={42} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));

    expect(await screen.findByText(/aucun réseau/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rejoindre par code/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /parcourir les partenaires/i })).toBeInTheDocument();
  });
});
