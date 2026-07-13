import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { setTokens } from "@/store/slices/authSlice";
import { HealthLibraryView } from "./HealthLibraryView";

function makeJwt(payload: unknown): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `h.${b64}.s`;
}
function ownerToken() {
  return makeJwt({ memberships: [{ farmId: 1, farmRole: "OWNER", permissions: ["*"] }] });
}

const SUBSCRIPTION = {
  id: 1,
  farmId: 1,
  status: "ACTIVE",
  planKey: null,
  expiresAt: null,
  modules: [
    { moduleKey: "module.health.basic", mode: "HARD", expiresAt: null },
    { moduleKey: "module.health.advanced", mode: "HARD", expiresAt: null },
  ],
};
const VACCINES = [
  { key: "newcastle", label: "Newcastle", disease: "newcastle", route: "", activeStrain: true, usage: "", wave: "", custom: false },
  { key: "nc-fermier", label: "NC fermier", disease: "newcastle", route: "drinking_water", activeStrain: false, usage: "", wave: "", custom: true },
];

function ok(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const url = input.url;
      if (url.includes("/catalog/vaccines")) return ok(VACCINES);
      if (url.includes("/subscription")) return ok(SUBSCRIPTION);
      if (url.endsWith("/api/v1/farms")) return ok([{ id: 1, name: "Ferme" }]);
      return ok([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("HealthLibraryView", () => {
  it("marks custom vaccines and offers create for a manager", async () => {
    const { store } = renderWithProviders(<HealthLibraryView />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));
    // custom row carries the "Perso" chip; platform row does not
    const customRow = (await screen.findByText("NC fermier")).closest("tr")!;
    expect(within(customRow).getByText(/perso/i)).toBeInTheDocument();
    // Both vaccines target "newcastle", so the disease column text collides with the
    // platform vaccine's own label ("Newcastle") in getByText — scope by table row
    // order (VACCINES[0] is the platform row) instead of an ambiguous text lookup.
    const table = screen.getByRole("table");
    const bodyRows = within(table).getAllByRole("row").slice(1);
    const platformRow = bodyRows[0];
    expect(platformRow).not.toBe(customRow);
    expect(within(platformRow).queryByText(/perso/i)).not.toBeInTheDocument();
    // create button visible for OWNER
    expect(screen.getByRole("button", { name: /nouveau vaccin/i })).toBeInTheDocument();
  });
});
