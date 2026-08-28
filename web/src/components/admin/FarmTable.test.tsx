import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { FarmTable } from "./FarmTable";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/fermes",
}));

function row(over: Record<string, unknown> = {}) {
  return {
    farmId: 1,
    name: "Ferme A",
    active: true,
    memberCount: 3,
    activeUnitCount: 2,
    lastActivityAt: new Date().toISOString(),
    ...over,
  };
}

function mockFarms(rows: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ data: rows }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  adminTokenStorage.clear();
});

describe("FarmTable", () => {
  it("lists farms with their counts", async () => {
    mockFarms([row()]);
    renderWithProviders(<FarmTable />);

    const line = (await screen.findByText("Ferme A")).closest("tr")!;
    expect(within(line).getByText("3")).toBeInTheDocument();
    expect(within(line).getByText("Aujourd'hui")).toBeInTheDocument();
  });

  it("flags a farm that never recorded anything", async () => {
    mockFarms([row({ lastActivityAt: null })]);
    renderWithProviders(<FarmTable />);

    // "Never" is not "a long time ago": it is a farm that has not started.
    expect(await screen.findByText("Jamais")).toBeInTheDocument();
  });

  it("marks a farm that went quiet", async () => {
    const twentyDaysAgo = new Date(Date.now() - 20 * 86_400_000).toISOString();
    mockFarms([row({ lastActivityAt: twentyDaysAgo })]);
    renderWithProviders(<FarmTable />);

    expect(await screen.findByText("Il y a 20 j")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    mockFarms([]);
    renderWithProviders(<FarmTable />);

    expect(await screen.findByText("Aucune ferme ne correspond.")).toBeInTheDocument();
  });
});
