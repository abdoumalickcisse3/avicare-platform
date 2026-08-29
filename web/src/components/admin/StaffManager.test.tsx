import { afterEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { StaffManager } from "./StaffManager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/personnel",
}));

const ME = { userId: 1, email: "me@jawdi.app", fullName: "Moi", permissions: ["*"], superAdmin: true };

const BOSS = {
  userId: 1,
  email: "me@jawdi.app",
  fullName: "Moi",
  permissions: ["*"],
  superAdmin: true,
  active: true,
  lastLoginAt: null,
};
const HELPER = {
  userId: 2,
  email: "aide@jawdi.app",
  fullName: "Aïda Sow",
  permissions: ["tenants:read"],
  superAdmin: false,
  active: true,
  lastLoginAt: null,
};
const CATALOG = [
  { resource: "tenants", label: "Fermes", verbs: ["read", "write"] },
  { resource: "staff", label: "Personnel", verbs: ["manage"] },
];

interface Options {
  me?: typeof ME;
  staff?: unknown[];
}

function mockApi({ me = ME, staff = [BOSS, HELPER] }: Options = {}) {
  const calls: { url: string; method: string; body?: string }[] = [];
  vi.stubGlobal(
    "fetch",
    // fetchBaseQuery hands fetch a Request object, not (url, init) — read the method and body
    // off the Request or every call looks like a GET with no payload.
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const url = request ? request.url : String(input);
      const method = request ? request.method : (init?.method ?? "GET");
      const body = request ? await request.clone().text() : (init?.body as string | undefined);
      calls.push({ url, method, body });
      const payload = url.includes("/staff/catalog")
        ? CATALOG
        : url.includes("/admin/me")
          ? me
          : url.includes("/admin/staff")
            ? staff
            : [];
      return new Response(JSON.stringify({ data: payload }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

async function rowFor(name: string) {
  return (await screen.findByText(name)).closest("tr") as HTMLElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
  adminTokenStorage.clear();
});

describe("StaffManager", () => {
  it("lists staff and names the ones with no permission at all", async () => {
    mockApi({ staff: [BOSS, { ...HELPER, permissions: [] }] });
    renderWithProviders(<StaffManager />);

    expect(await screen.findByText("Aïda Sow")).toBeInTheDocument();
    // "Staff with nothing granted" is a real state the founder bootstrap can produce; showing
    // an empty cell would read as a loading glitch.
    expect(screen.getByText(/Aucune permission/)).toBeInTheDocument();
  });

  it("locks your own row", async () => {
    mockApi();
    renderWithProviders(<StaffManager />);

    const mine = await rowFor("Moi");
    // Mirrors the server guard: staff:manage must not be a ladder to "*" via your own row.
    expect(within(mine).getByRole("button", { name: /permissions/i })).toBeDisabled();
    expect(within(mine).getByRole("button", { name: /retirer/i })).toBeDisabled();
  });

  it("locks the last super-admin so the console cannot be orphaned", async () => {
    mockApi({
      me: { ...ME, userId: 9 },
      staff: [BOSS, HELPER],
    });
    renderWithProviders(<StaffManager />);

    const boss = await rowFor("Moi");
    expect(within(boss).getByRole("button", { name: /retirer/i })).toBeDisabled();
    // The other one is not a super-admin, so it stays editable.
    const helper = await rowFor("Aïda Sow");
    expect(within(helper).getByRole("button", { name: /retirer/i })).toBeEnabled();
  });

  it("sends the whole permission set, not a delta", async () => {
    const calls = mockApi();
    renderWithProviders(<StaffManager />);

    const helper = await rowFor("Aïda Sow");
    await userEvent.click(within(helper).getByRole("button", { name: /permissions/i }));
    await userEvent.click(await screen.findByLabelText("Modifier"));
    await userEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT")!;
    expect(JSON.parse(put.body as string)).toEqual({
      permissions: ["tenants:read", "tenants:write"],
    });
  });

  it("offers the wildcard only to a super-admin", async () => {
    mockApi({ me: { ...ME, userId: 9, permissions: ["staff:manage"], superAdmin: false } });
    renderWithProviders(<StaffManager />);

    const helper = await rowFor("Aïda Sow");
    await userEvent.click(within(helper).getByRole("button", { name: /permissions/i }));

    // Without this, staff:manage escalates to super-admin through a second account.
    expect(await screen.findByLabelText(/Super-administrateur/)).toBeDisabled();
  });

  it("hides the per-permission checkboxes once the wildcard is on", async () => {
    mockApi();
    renderWithProviders(<StaffManager />);

    const helper = await rowFor("Aïda Sow");
    await userEvent.click(within(helper).getByRole("button", { name: /permissions/i }));
    await userEvent.click(await screen.findByLabelText(/Super-administrateur/));

    // Ticking boxes under a wildcard that already covers everything is a lie about what is stored.
    expect(screen.queryByLabelText("Modifier")).not.toBeInTheDocument();
    expect(screen.getByText(/toutes les permissions, présentes et futures/)).toBeInTheDocument();
  });
});
