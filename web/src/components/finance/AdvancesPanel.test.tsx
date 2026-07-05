import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { setTokens } from "@/store/slices/authSlice";
import { AdvancesPanel } from "./AdvancesPanel";
import type { Advance, Member } from "@/types";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

function makeJwt(payload: unknown): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `h.${b64}.s`;
}

function ownerToken() {
  return makeJwt({ memberships: [{ farmId: 1, farmRole: "OWNER", permissions: ["*"] }] });
}

const MEMBERS: Member[] = [
  {
    id: 1,
    userId: 7,
    farmId: 1,
    fullName: "Awa Diop",
    email: "awa@example.com",
    phone: null,
    role: "FARMER",
    permissions: [],
    active: true,
  },
];

const ADVANCES: Advance[] = [
  {
    id: 1,
    userId: 7,
    amountXof: 20000,
    reason: "Urgence médicale",
    status: "PENDING",
    requestedAt: "2026-07-01T08:00:00Z",
    remainingXof: 20000,
  },
  {
    id: 2,
    userId: 7,
    amountXof: 15000,
    reason: "Avance ordinaire",
    status: "APPROVED",
    requestedAt: "2026-06-15T08:00:00Z",
    remainingXof: 5000,
  },
];

let calls: { url: string; method: string }[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = input instanceof Request ? input.method : (init?.method ?? "GET");
      calls.push({ url, method });
      if (url.includes("/finance/advances/1/approve")) return respond({ ...ADVANCES[0], status: "APPROVED" });
      if (url.includes("/finance/advances")) return respond(ADVANCES);
      if (url.includes("/users")) return respond(MEMBERS);
      return respond([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("AdvancesPanel", () => {
  it("shows Approuver/Rejeter only on PENDING advances", async () => {
    const { store } = renderWithProviders(<AdvancesPanel farmId={1} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));

    const pendingRow = (await screen.findByText("Urgence médicale")).closest("tr")!;
    const approvedRow = screen.getByText("Avance ordinaire").closest("tr")!;

    expect(within(pendingRow).getByRole("button", { name: /Approuver/i })).toBeInTheDocument();
    expect(within(pendingRow).getByRole("button", { name: /Rejeter/i })).toBeInTheDocument();
    expect(within(approvedRow).queryByRole("button", { name: /Approuver/i })).not.toBeInTheDocument();
    expect(within(approvedRow).queryByRole("button", { name: /Rejeter/i })).not.toBeInTheDocument();
  });

  it("posts to the correct approve URL", async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<AdvancesPanel farmId={1} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));

    await screen.findByText("Urgence médicale");
    await user.click(screen.getByRole("button", { name: /Approuver/i }));
    await user.click(await screen.findByRole("button", { name: "Confirmer" }));

    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("/finance/advances/1/approve") && c.method === "POST")).toBe(
        true,
      ),
    );
  });
});
