import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { FarmsAtRisk } from "./FarmsAtRisk";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/sante",
}));

function mockRows(rows: unknown[]) {
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

describe("FarmsAtRisk", () => {
  it("shows the reason, not just the level", async () => {
    mockRows([
      {
        farmId: 1,
        name: "Ferme A",
        level: "AT_RISK",
        daysSinceLastEntry: 30,
        reason: "Aucune saisie depuis 30 jours.",
      },
    ]);
    renderWithProviders(<FarmsAtRisk />);

    const line = (await screen.findByText("Ferme A")).closest("tr")!;
    // Support needs something to say when they call, not a colour.
    expect(within(line).getByText("Aucune saisie depuis 30 jours.")).toBeInTheDocument();
    expect(within(line).getByText("À risque")).toBeInTheDocument();
  });

  it("shows a dash for a farm that never started", async () => {
    mockRows([
      {
        farmId: 2,
        name: "Jamais démarrée",
        level: "AT_RISK",
        daysSinceLastEntry: null,
        reason: "Aucune saisie depuis la création du compte.",
      },
    ]);
    renderWithProviders(<FarmsAtRisk />);

    const line = (await screen.findByText("Jamais démarrée")).closest("tr")!;
    // It did not go quiet after N days: there is no day count to show.
    expect(within(line).getByText("—")).toBeInTheDocument();
  });

  it("says so when every farm is up to date", async () => {
    mockRows([]);
    renderWithProviders(<FarmsAtRisk />);

    expect(await screen.findByText(/Aucune ferme ne décroche/)).toBeInTheDocument();
  });

  it("exports the list as CSV", async () => {
    mockRows([
      { farmId: 1, name: "Ferme A", level: "WATCH", daysSinceLastEntry: 9, reason: "Saisie ralentie." },
    ]);
    const createObjectURL = vi.fn((blob: Blob) => `blob:${blob.type}`);
    const revokeObjectURL = vi.fn();
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    try {
      renderWithProviders(<FarmsAtRisk />);
      await userEvent.click(await screen.findByRole("button", { name: /exporter/i }));

      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    } finally {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    }
  });
});
