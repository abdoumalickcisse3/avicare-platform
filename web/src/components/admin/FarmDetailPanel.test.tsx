import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { FarmDetailPanel } from "./FarmDetailPanel";

function mockFarm(over: Record<string, unknown> = {}, permissions: string[] = ["*"]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/admin/me")) {
        return new Response(
          JSON.stringify({
            data: { userId: 1, email: "s@x.io", fullName: "S", permissions, superAdmin: false },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
          JSON.stringify({
            data: {
              farmId: 8,
              name: "Ferme Complète",
              currency: "XOF",
              timezone: "Africa/Dakar",
              active: true,
              memberCount: 4,
              activeUnitCount: 2,
              totalHeadcount: 950,
              lastActivityAt: null,
              enabledModules: ["poultry"],
              partners: [],
              ...over,
            },
          }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  adminTokenStorage.clear();
});

describe("FarmDetailPanel", () => {
  it("shows the farm identity and its figures", async () => {
    mockFarm();
    renderWithProviders(<FarmDetailPanel farmId={8} />);

    expect(await screen.findByText("Ferme Complète")).toBeInTheDocument();
    expect(screen.getByText("950")).toBeInTheDocument();
    // A farm that never recorded anything must say so, not show a fabricated date.
    expect(screen.getByText("Jamais")).toBeInTheDocument();
  });

  it("names the reason when the farm joined no network", async () => {
    mockFarm();
    renderWithProviders(<FarmDetailPanel farmId={8} />);

    expect(await screen.findByText(/n'a rejoint aucun réseau/)).toBeInTheDocument();
  });

  it("marks the modules the farm has enabled", async () => {
    mockFarm({ enabledModules: ["commercial"] });
    renderWithProviders(<FarmDetailPanel farmId={8} />);

    expect(await screen.findByText("commercial")).toBeInTheDocument();
    expect(screen.getByText("finance")).toBeInTheDocument();
  });

  it("is read-only without tenants:write", async () => {
    mockFarm({}, ["tenants:read"]);
    renderWithProviders(<FarmDetailPanel farmId={8} />);

    expect(await screen.findByText(/Lecture seule/)).toBeInTheDocument();
  });

  it("lists the partner networks the farm belongs to", async () => {
    mockFarm({
      partners: [
        { partnerId: 2, partnerName: "Provende du Sahel", type: "FEED_SUPPLIER", status: "CONFIRMED" },
      ],
    });
    renderWithProviders(<FarmDetailPanel farmId={8} />);

    expect(await screen.findByText("Provende du Sahel")).toBeInTheDocument();
    expect(screen.getByText("CONFIRMED")).toBeInTheDocument();
  });
});
