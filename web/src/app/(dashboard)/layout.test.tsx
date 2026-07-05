import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import DashboardLayout from "./layout";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

beforeEach(() => {
  replace.mockReset();
  window.localStorage.clear();
});
afterEach(() => window.localStorage.clear());

describe("DashboardLayout auth guard", () => {
  it("renders the app (no redirect) when a token is present — a refresh must not bounce to /login", async () => {
    window.localStorage.setItem("avicare_access_token", "tok");
    renderWithProviders(
      <DashboardLayout>
        <div>Contenu protégé</div>
      </DashboardLayout>,
    );
    expect(await screen.findByText("Contenu protégé")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to /login when no token is present", async () => {
    renderWithProviders(
      <DashboardLayout>
        <div>Contenu protégé</div>
      </DashboardLayout>,
    );
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Contenu protégé")).not.toBeInTheDocument();
  });
});
