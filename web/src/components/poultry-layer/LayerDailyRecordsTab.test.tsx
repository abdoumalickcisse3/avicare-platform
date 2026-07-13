import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { LayerDailyRecordsTab } from "./LayerDailyRecordsTab";
import type { ProductionUnit } from "@/types";

const UNIT: ProductionUnit = {
  id: 3,
  farmId: 1,
  species: "POULTRY",
  unitKind: "BATCH",
  breedId: 5,
  name: "Lot Pondeuse",
  startDate: "2026-03-01",
  endDate: null,
  currentCount: 980,
  status: "ACTIVE",
};

const RECORDS = [
  { id: 1, productionUnitId: 3, recordDate: "2026-07-11", mortalityCount: 0, feedKg: 110, waterL: 200, observations: null },
];

function ok(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }));
}
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/daily-records")) return ok(RECORDS);
    return ok([]);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("LayerDailyRecordsTab", () => {
  it("lists the daily records of the flock", async () => {
    renderWithProviders(<LayerDailyRecordsTab farmId={1} unit={UNIT} />);
    expect(await screen.findByText("110")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /saisir/i })).toBeInTheDocument();
  });
});
