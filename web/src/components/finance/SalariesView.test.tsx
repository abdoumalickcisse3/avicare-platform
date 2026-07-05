import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { setTokens } from "@/store/slices/authSlice";
import { SalariesView } from "./SalariesView";
import type { Advance, Member, Salary, SalarySetting } from "@/types";

function respond(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } }),
  );
}

function makeJwt(payload: unknown): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `h.${b64}.s`;
}

function ownerToken() {
  return makeJwt({ memberships: [{ farmId: 1, farmRole: "OWNER", permissions: ["*"] }] });
}

function farmerToken() {
  return makeJwt({ memberships: [{ farmId: 1, farmRole: "FARMER", permissions: ["poultry:read"] }] });
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

const SETTINGS: SalarySetting[] = [{ id: 1, userId: 7, monthlySalaryXof: 120000, active: true }];

const SALARIES: Salary[] = [
  {
    id: 1,
    userId: 7,
    period: "2026-07",
    grossXof: 120000,
    advanceDeductedXof: 0,
    netXof: 120000,
    status: "DUE",
    paidAt: null,
  },
  {
    id: 2,
    userId: 7,
    period: "2026-06",
    grossXof: 120000,
    advanceDeductedXof: 10000,
    netXof: 110000,
    status: "PAID",
    paidAt: "2026-06-30T10:00:00Z",
  },
];

const ADVANCES: Advance[] = [];

let calls: { url: string; method: string; body: Record<string, unknown> | null }[] = [];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = input instanceof Request ? input.method : (init?.method ?? "GET");
      let body: Record<string, unknown> | null = null;
      if (input instanceof Request) {
        try {
          body = await input.clone().json();
        } catch {
          /* no body */
        }
      } else if (init?.body) {
        body = JSON.parse(init.body as string);
      }
      calls.push({ url, method, body });
      // /finance/ must be matched before any generic /api/v1/farms or /users fallback.
      if (url.includes("/finance/salary-settings")) return respond(SETTINGS);
      if (url.includes("/finance/salaries/generate")) return respond(SALARIES);
      if (url.includes("/finance/salaries")) return respond(SALARIES);
      if (url.includes("/finance/advances")) return respond(ADVANCES);
      if (url.includes("/users")) return respond(MEMBERS);
      return respond([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("SalariesView", () => {
  it("joins the member's name in the settings table", async () => {
    const { store } = renderWithProviders(<SalariesView farmId={1} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));

    const settingsTable = await screen.findByRole("table", { name: "Réglages de salaire" });
    expect(within(settingsTable).getByText("Awa Diop")).toBeInTheDocument();
  });

  it("shows 'Marquer payé' on a DUE salary but not on a PAID one", async () => {
    const { store } = renderWithProviders(<SalariesView farmId={1} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));

    const dueRow = (await screen.findByText("2026-07")).closest("tr")!;
    const paidRow = screen.getByText("2026-06").closest("tr")!;

    expect(within(dueRow).getByRole("button", { name: /Marquer payé/i })).toBeInTheDocument();
    expect(within(paidRow).queryByRole("button", { name: /Marquer payé/i })).not.toBeInTheDocument();
  });

  it("sends the exact period when generating salaries", async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<SalariesView farmId={1} />);
    store.dispatch(setTokens({ accessToken: ownerToken(), refreshToken: "r", expiresIn: 3600 }));

    await screen.findByRole("table", { name: "Réglages de salaire" });

    const periodField = screen.getByLabelText("Période") as HTMLInputElement;
    const period = periodField.value;

    await user.click(screen.getByRole("button", { name: /Générer les salaires/i }));

    await waitFor(() =>
      expect(
        calls.some((c) => c.url.includes("/finance/salaries/generate") && c.method === "POST"),
      ).toBe(true),
    );
    const generateCall = calls.find((c) => c.url.includes("/finance/salaries/generate"))!;
    expect(generateCall.body).toEqual({ period });
  });

  it("hides all write actions when user lacks manager role", async () => {
    const { store } = renderWithProviders(<SalariesView farmId={1} />);
    store.dispatch(setTokens({ accessToken: farmerToken(), refreshToken: "r", expiresIn: 3600 }));

    // Wait for settings table to render (contains "Awa Diop" and settings data)
    await screen.findByRole("table", { name: "Réglages de salaire" });

    // Assert all write buttons are absent
    expect(screen.queryByRole("button", { name: /Ajouter/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Générer les salaires/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marquer payé/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approuver/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rejeter/i })).not.toBeInTheDocument();
  });
});
