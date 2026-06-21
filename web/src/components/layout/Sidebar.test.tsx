import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("shows the broiler item and hides Œufs when only broiler is active", () => {
    mockModules(["module.poultry.broiler"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Poulets de chair")).toBeInTheDocument();
    expect(screen.queryByText("Œufs")).not.toBeInTheDocument();
  });

  it("shows Œufs and hides the broiler item when only layer is active", () => {
    mockModules(["module.poultry.layer"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Œufs")).toBeInTheDocument();
    expect(screen.queryByText("Poulets de chair")).not.toBeInTheDocument();
  });

  it("shows everything when both modules are active", () => {
    mockModules(["module.poultry.broiler", "module.poultry.layer"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Poulets de chair")).toBeInTheDocument();
    expect(screen.getByText("Œufs")).toBeInTheDocument();
  });

  it("further filters by the current farm's production focus", () => {
    // Both modules active, but the farm is broiler-only → Œufs hidden.
    mockModules(["module.poultry.broiler", "module.poultry.layer"]);
    mockFocus(["broiler"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Poulets de chair")).toBeInTheDocument();
    expect(screen.queryByText("Œufs")).not.toBeInTheDocument();
  });

  it("shows the empty-state CTA when no module is active", () => {
    mockModules([]);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByText("Poulets de chair")).not.toBeInTheDocument();
    expect(screen.queryByText("Œufs")).not.toBeInTheDocument();
    expect(screen.getByText(/activez un module/i)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /activer des modules/i });
    expect(cta).toHaveAttribute("href", "/fermes/1?tab=subscription");
  });

  it("shows skeletons while loading", () => {
    mockModules([], { isLoading: true });
    const { container } = renderWithProviders(<Sidebar />);
    expect(container.querySelector(".MuiSkeleton-root")).toBeInTheDocument();
    expect(screen.queryByText("Poulets de chair")).not.toBeInTheDocument();
  });

  it("collapses a group's children when its header is clicked", async () => {
    const user = userEvent.setup();
    mockModules(["module.poultry.broiler"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Poulets de chair")).toBeInTheDocument(); // open by default
    await user.click(screen.getByText("Élevage"));
    // Collapse unmounts children after its exit transition (async in jsdom).
    await waitFor(() =>
      expect(screen.queryByText("Poulets de chair")).not.toBeInTheDocument(),
    );
  });

  it("renders the Stocks group with its children when inventory is active", () => {
    mockModules(["module.inventory"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Stocks")).toBeInTheDocument();
    expect(screen.getByText("Bons d'achat")).toBeInTheDocument();
    expect(screen.getByText("Formules")).toBeInTheDocument();
  });

  it("hides the Stocks group when inventory is inactive", () => {
    mockModules(["module.poultry.broiler"]);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByText("Stocks")).not.toBeInTheDocument();
  });

  it("commercial group shows 4 leaves (no Livraisons/Paiements/Vue d'ensemble)", () => {
    mockModules(["module.commercial.basic"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Clients")).toBeInTheDocument();
    expect(screen.getByText("Commandes")).toBeInTheDocument();
    expect(screen.getByText("Ventes")).toBeInTheDocument();
    expect(screen.getByText("Factures")).toBeInTheDocument();
    expect(screen.queryByText("Livraisons")).not.toBeInTheDocument();
    expect(screen.queryByText("Paiements")).not.toBeInTheDocument();
  });
});
