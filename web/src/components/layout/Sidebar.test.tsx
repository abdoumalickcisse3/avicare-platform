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

const permsMock = vi.fn();
vi.mock("@/hooks/useFarmPermissions", () => ({
  useFarmPermissions: () => permsMock(),
}));

function mockPerms(perms: string[]) {
  permsMock.mockReturnValue({
    can: (p: string) =>
      perms.includes("*") ||
      perms.includes(p) ||
      perms.includes(`${p.split(":")[0]}:*`),
  });
}

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
    permsMock.mockReset();
    mockFocus([]); // default: no explicit focus → modules alone decide
    mockPerms(["*"]); // default: OWNER-like, sees everything
  });

  it("always shows Fermes and Réglages", () => {
    mockModules(["module.poultry.broiler"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Fermes")).toBeInTheDocument();
    expect(screen.getByText("Réglages")).toBeInTheDocument();
  });

  it("shows the broiler item and hides Œufs when only broiler is active", async () => {
    const user = userEvent.setup();
    mockModules(["module.poultry.broiler"]);
    renderWithProviders(<Sidebar />);
    // Groups are collapsed by default (no active route here) — expand Élevage first.
    await user.click(screen.getByText("Élevage"));
    expect(await screen.findByText("Poulets de chair")).toBeInTheDocument();
    expect(screen.queryByText("Œufs")).not.toBeInTheDocument();
  });

  it("shows Œufs and hides the broiler item when only layer is active", async () => {
    const user = userEvent.setup();
    mockModules(["module.poultry.layer"]);
    renderWithProviders(<Sidebar />);
    await user.click(screen.getByText("Élevage"));
    expect(await screen.findByText("Œufs")).toBeInTheDocument();
    expect(screen.queryByText("Poulets de chair")).not.toBeInTheDocument();
  });

  it("shows everything when both modules are active", async () => {
    const user = userEvent.setup();
    mockModules(["module.poultry.broiler", "module.poultry.layer"]);
    renderWithProviders(<Sidebar />);
    await user.click(screen.getByText("Élevage"));
    expect(await screen.findByText("Poulets de chair")).toBeInTheDocument();
    expect(screen.getByText("Œufs")).toBeInTheDocument();
  });

  it("further filters by the current farm's production focus", async () => {
    const user = userEvent.setup();
    // Both modules active, but the farm is broiler-only → Œufs hidden.
    mockModules(["module.poultry.broiler", "module.poultry.layer"]);
    mockFocus(["broiler"]);
    renderWithProviders(<Sidebar />);
    await user.click(screen.getByText("Élevage"));
    expect(await screen.findByText("Poulets de chair")).toBeInTheDocument();
    expect(screen.queryByText("Œufs")).not.toBeInTheDocument();
  });

  it("shows the empty-state CTA when no module is active", () => {
    mockModules([]);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByText("Poulets de chair")).not.toBeInTheDocument();
    expect(screen.queryByText("Œufs")).not.toBeInTheDocument();
    expect(screen.getByText(/activez un module/i)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /activer des modules/i });
    expect(cta).toHaveAttribute("href", "/fermes/1");
  });

  it("shows skeletons while loading", () => {
    mockModules([], { isLoading: true });
    const { container } = renderWithProviders(<Sidebar />);
    expect(container.querySelector(".MuiSkeleton-root")).toBeInTheDocument();
    expect(screen.queryByText("Poulets de chair")).not.toBeInTheDocument();
  });

  it("keeps a group collapsed by default and expands it when its header is clicked", async () => {
    const user = userEvent.setup();
    mockModules(["module.poultry.broiler"]);
    renderWithProviders(<Sidebar />);
    // Collapsed by default: the child is not mounted until the group is opened.
    expect(screen.queryByText("Poulets de chair")).not.toBeInTheDocument();
    await user.click(screen.getByText("Élevage"));
    expect(await screen.findByText("Poulets de chair")).toBeInTheDocument();
    // Clicking again collapses it (children unmount after the exit transition).
    await user.click(screen.getByText("Élevage"));
    await waitFor(() =>
      expect(screen.queryByText("Poulets de chair")).not.toBeInTheDocument(),
    );
  });

  it("renders the Stocks group with its children when inventory is active", async () => {
    const user = userEvent.setup();
    mockModules(["module.inventory"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Stocks")).toBeInTheDocument();
    await user.click(screen.getByText("Stocks"));
    expect(await screen.findByText("Bons d'achat")).toBeInTheDocument();
    expect(screen.getByText("Formules")).toBeInTheDocument();
  });

  it("hides the Stocks group when inventory is inactive", () => {
    mockModules(["module.poultry.broiler"]);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByText("Stocks")).not.toBeInTheDocument();
  });

  it("commercial group shows 4 leaves (no Livraisons/Paiements/Vue d'ensemble)", async () => {
    const user = userEvent.setup();
    mockModules(["module.commercial.basic"]);
    renderWithProviders(<Sidebar />);
    await user.click(screen.getByText("Commercial"));
    expect(await screen.findByText("Clients")).toBeInTheDocument();
    expect(screen.getByText("Commandes")).toBeInTheDocument();
    expect(screen.getByText("Ventes")).toBeInTheDocument();
    expect(screen.getByText("Factures")).toBeInTheDocument();
    expect(screen.queryByText("Livraisons")).not.toBeInTheDocument();
    expect(screen.queryByText("Paiements")).not.toBeInTheDocument();
  });
});

describe("Sidebar permission gating", () => {
  beforeEach(() => {
    activeModulesMock.mockReset();
    focusMock.mockReset();
    permsMock.mockReset();
    mockFocus([]);
  });

  it("hides Stocks, Commercial and Réglages from a FARMER (poultry+health only)", () => {
    mockModules(["module.poultry.broiler", "module.inventory", "module.commercial.basic"]);
    mockPerms(["poultry:read", "poultry:write", "health:read", "health:write"]);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByText("Stocks")).not.toBeInTheDocument();
    expect(screen.queryByText("Commercial")).not.toBeInTheDocument();
    expect(screen.queryByText("Réglages")).not.toBeInTheDocument();
    expect(screen.getByText("Élevage")).toBeInTheDocument();
  });

  it("shows every module to an OWNER (wildcard)", () => {
    mockModules(["module.poultry.broiler", "module.inventory", "module.commercial.basic"]);
    mockPerms(["*"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Stocks")).toBeInTheDocument();
    expect(screen.getByText("Commercial")).toBeInTheDocument();
    expect(screen.getByText("Réglages")).toBeInTheDocument();
  });

  it("still hides a module the farm has not subscribed to, even with the permission", () => {
    mockModules(["module.poultry.broiler"]); // inventory NOT subscribed
    mockPerms(["*"]);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByText("Stocks")).not.toBeInTheDocument();
  });

  it("shows the Finance group with its children when module.finance is active and finance:read is granted", async () => {
    const user = userEvent.setup();
    mockModules(["module.finance"]);
    mockPerms(["finance:read"]);
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Finance")).toBeInTheDocument();
    await user.click(screen.getByText("Finance"));
    expect(await screen.findByText("Dépenses")).toBeInTheDocument();
    expect(screen.getByText("Analytique")).toBeInTheDocument();
  });

  it("hides Finance from a FARMER (poultry+health only), even with module.finance active", () => {
    mockModules(["module.poultry.broiler", "module.finance"]);
    mockPerms(["poultry:read", "poultry:write", "health:read", "health:write"]);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByText("Finance")).not.toBeInTheDocument();
  });

  it("still hides Finance when the farm has not subscribed to the module, even with the wildcard permission", () => {
    mockModules(["module.poultry.broiler"]); // finance NOT subscribed
    mockPerms(["*"]);
    renderWithProviders(<Sidebar />);
    expect(screen.queryByText("Finance")).not.toBeInTheDocument();
  });
});
