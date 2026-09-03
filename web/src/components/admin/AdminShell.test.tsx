import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { AdminShell } from "./AdminShell";

let mockPathname = "/console";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => mockPathname,
}));

function mockMe(permissions: string[], superAdmin = false) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: { userId: 1, email: "s@jawdi.app", fullName: "S", permissions, superAdmin },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  adminTokenStorage.clear();
  mockPathname = "/console";
});

function render() {
  return renderWithProviders(
    <AdminShell>
      <div />
    </AdminShell>,
  );
}

describe("AdminShell", () => {
  it("shows a group only when the caller may use something inside it", async () => {
    mockMe(["tenants:read"]);
    render();

    expect(await screen.findByRole("button", { name: /clients/i })).toBeInTheDocument();
    // No supervision permission at all → the whole group disappears with its entries.
    expect(screen.queryByRole("button", { name: /supervision/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /plateforme/i })).not.toBeInTheDocument();
  });

  it("opens a group and reveals only the entries the caller may use", async () => {
    const user = userEvent.setup();
    mockMe(["tenants:read"]);
    render();

    await user.click(await screen.findByRole("button", { name: /clients/i }));

    expect(await screen.findByRole("menuitem", { name: /fermes/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /santé/i })).toBeInTheDocument();
    // No users:read → the entry is not rendered at all, not merely disabled.
    expect(screen.queryByRole("menuitem", { name: /utilisateurs/i })).not.toBeInTheDocument();
  });

  it("the wildcard opens every group", async () => {
    mockMe(["*"], true);
    render();

    expect(await screen.findByRole("button", { name: /supervision/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clients/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /plateforme/i })).toBeInTheDocument();
    expect(screen.getByText("Super-admin")).toBeInTheDocument();
  });

  it("a resource wildcard opens its own resource", async () => {
    const user = userEvent.setup();
    mockMe(["users:*"]);
    render();

    await user.click(await screen.findByRole("button", { name: /clients/i }));

    expect(await screen.findByRole("menuitem", { name: /utilisateurs/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /fermes/i })).not.toBeInTheDocument();
  });

  it("keeps the kill switch one click away, never inside a dropdown", async () => {
    mockMe(["*"], true);
    render();

    // A link, not a menu button: seconds matter when this one is needed.
    expect(await screen.findByRole("link", { name: /urgence/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pilotage/i })).toBeInTheDocument();
  });

  it("marks the group holding the current page", async () => {
    mockPathname = "/console/securite";
    mockMe(["*"], true);
    render();

    const supervision = await screen.findByRole("button", { name: /supervision/i });
    expect(supervision).toHaveStyle({ fontWeight: "700" });
  });
});
