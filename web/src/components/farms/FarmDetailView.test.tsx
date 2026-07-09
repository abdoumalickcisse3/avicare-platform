import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { FarmDetailView } from "./FarmDetailView";
import type { Farm } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const farm: Farm = {
  id: 1,
  name: "Ferme du Lac",
  description: null,
  location: "Bouaké",
  gpsLatitude: null,
  gpsLongitude: null,
  capacity: null,
  timezone: null,
  currency: null,
  createdBy: 1,
  active: true,
  createdAt: "2026-01-01T00:00:00",
  productionFocus: [],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      // /dashboard must be matched before the generic /api/v1/farms/{id} shape.
      if (url.includes("/dashboard")) {
        return respond({
          period: { kind: "preset", value: "7d", from: "2026-07-02", to: "2026-07-09" },
          commercial: null,
          livestock: {
            activeBatches: 1,
            totalHeadcount: 769,
            deaths: 5,
            mortalityRate: 3.1,
            mortalitySeries: [],
            avgDailyGainG: null,
            layingRate: null,
            layingSeries: [],
            vaccinationsCount: 0,
            treatmentsCount: 0,
            dailyFeedKg: 42.5,
          },
          inventory: null,
        });
      }
      if (url.includes("/api/v1/farms/1")) {
        return respond(farm);
      }
      return respond(null);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("FarmDetailView overview KPI cards", () => {
  it("renders the 4 KPI cards from the 7-day dashboard aggregate", async () => {
    renderWithProviders(<FarmDetailView farmId={1} />);

    expect(await screen.findByText("769")).toBeInTheDocument(); // Effectif total
    expect(screen.getByText("3.1 %")).toBeInTheDocument(); // Mortalité
    expect(screen.getByText("n/d")).toBeInTheDocument(); // Production (layingRate null)
    expect(screen.getByText("42.5 kg")).toBeInTheDocument(); // Aliment
  });
});
