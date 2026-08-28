import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { AdminShell } from "./AdminShell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console",
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
});

describe("AdminShell", () => {
  it("renders only the entries the caller may use", async () => {
    mockMe(["tenants:read"]);
    renderWithProviders(
      <AdminShell>
        <div />
      </AdminShell>,
    );

    expect(await screen.findByText("Fermes")).toBeInTheDocument();
    // No users:read → the entry is not rendered at all, not merely disabled.
    expect(screen.queryByText("Utilisateurs")).not.toBeInTheDocument();
  });

  it("the wildcard opens every entry", async () => {
    mockMe(["*"], true);
    renderWithProviders(
      <AdminShell>
        <div />
      </AdminShell>,
    );

    expect(await screen.findByText("Fermes")).toBeInTheDocument();
    expect(screen.getByText("Utilisateurs")).toBeInTheDocument();
    expect(screen.getByText("Super-admin")).toBeInTheDocument();
  });

  it("a resource wildcard opens its own resource", async () => {
    mockMe(["users:*"]);
    renderWithProviders(
      <AdminShell>
        <div />
      </AdminShell>,
    );

    expect(await screen.findByText("Utilisateurs")).toBeInTheDocument();
    expect(screen.queryByText("Fermes")).not.toBeInTheDocument();
  });
});
