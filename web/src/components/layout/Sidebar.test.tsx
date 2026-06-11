import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

const activeModulesMock = vi.fn();
vi.mock("@/hooks/useActiveModules", () => ({
  useActiveModules: () => activeModulesMock(),
}));

const focusMock = vi.fn();
vi.mock("@/hooks/useCurrentFarmFocus", () => ({
  useCurrentFarmFocus: () => focusMock(),
}));

function mockModules(active: string[], { isLoading = false } = {}) {
  activeModulesMock.mockReturnValue({
    farmId: 1,
    hasFarm: true,
    isLoading,
    activeModules: active,
    isModuleActive: (k: string) => active.includes(k),
  });
}

function mockFocus(focus: string[]) {
  focusMock.mockReturnValue({ focus, hasFarm: true, isLoading: false });
}

describe("Sidebar module filtering", () => {
  beforeEach(() => {
    activeModulesMock.mockReset();
    focusMock.mockReset();
    mockFocus([]); // default: no explicit focus → modules alone decide
  });

  it("always shows Fermes and Réglages", () => {
    mockModules(["module.poultry.broiler"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Fermes")).toBeInTheDocument();
    expect(screen.getByText("Réglages")).toBeInTheDocument();
  });

  it("shows broiler items and hides Œufs when only broiler is active", () => {
    mockModules(["module.poultry.broiler"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Lots")).toBeInTheDocument();
    expect(screen.getByText("Poulets de chair")).toBeInTheDocument();
    expect(screen.queryByText("Œufs")).not.toBeInTheDocument();
  });

  it("shows Œufs and hides broiler items when only layer is active", () => {
    mockModules(["module.poultry.layer"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Œufs")).toBeInTheDocument();
    expect(screen.queryByText("Lots")).not.toBeInTheDocument();
    expect(screen.queryByText("Poulets de chair")).not.toBeInTheDocument();
  });

  it("shows everything when both modules are active", () => {
    mockModules(["module.poultry.broiler", "module.poultry.layer"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Lots")).toBeInTheDocument();
    expect(screen.getByText("Œufs")).toBeInTheDocument();
  });

  it("further filters by the current farm's production focus", () => {
    // Both modules active, but the farm is broiler-only → Œufs hidden.
    mockModules(["module.poultry.broiler", "module.poultry.layer"]);
    mockFocus(["broiler"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Lots")).toBeInTheDocument();
    expect(screen.queryByText("Œufs")).not.toBeInTheDocument();
  });

  it("shows the empty-state CTA when no module is active", () => {
    mockModules([]);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByText("Lots")).not.toBeInTheDocument();
    expect(screen.queryByText("Œufs")).not.toBeInTheDocument();
    expect(screen.getByText(/activez un module/i)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /activer des modules/i });
    expect(cta).toHaveAttribute("href", "/fermes/1?tab=subscription");
  });

  it("shows skeletons while loading", () => {
    mockModules([], { isLoading: true });
    const { container } = renderWithProviders(<Sidebar />);
    expect(container.querySelector(".MuiSkeleton-root")).toBeInTheDocument();
    expect(screen.queryByText("Lots")).not.toBeInTheDocument();
  });
});
