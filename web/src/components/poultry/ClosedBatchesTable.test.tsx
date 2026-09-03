import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ClosedBatchesTable } from "./ClosedBatchesTable";
import type { ClosureSummary } from "@/types";

const row = (over: Partial<ClosureSummary>): ClosureSummary => ({
  productionUnitId: 1,
  unitName: "Bande A",
  startDate: "2026-07-01",
  endDate: "2026-08-15",
  durationDays: 45,
  initialCount: 1000,
  deaths: 20,
  mortalityPercent: 2,
  exitWeightG: 2000,
  feedConversionRatio: 1.9,
  revenueXof: 1_800_000,
  totalCostXof: 1_240_000,
  marginXof: 560_000,
  costPerKgXof: 633,
  valuationIncomplete: false,
  ...over,
});

let rows: ClosureSummary[] = [];

vi.mock("@/store/api/closureListApi", () => ({
  useGetFarmClosuresQuery: () => ({ data: rows, isLoading: false, error: undefined }),
}));

function setup(data: ClosureSummary[]) {
  rows = data;
  return renderWithProviders(<ClosedBatchesTable farmId={7} />);
}

const bodyNames = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0].textContent);

describe("ClosedBatchesTable", () => {
  it("invites the farmer to close a batch when there is none", () => {
    setup([]);
    expect(screen.getByText(/aucune bande clôturée/i)).toBeInTheDocument();
  });

  it("lists the closed cycles with the comparable columns", () => {
    setup([row({})]);

    expect(screen.getByText("Bande A")).toBeInTheDocument();
    expect(screen.getByText("45 j")).toBeInTheDocument();
    expect(screen.getByText("2 %")).toBeInTheDocument();
    expect(screen.getByText("1.9")).toBeInTheDocument();
  });

  it("sorts on the column the reader picks", async () => {
    const user = userEvent.setup();
    setup([
      row({ productionUnitId: 1, unitName: "Bande A", marginXof: 100 }),
      row({ productionUnitId: 2, unitName: "Bande B", marginXof: 900 }),
    ]);

    await user.click(screen.getByRole("button", { name: /marge/i }));

    expect(bodyNames()[0]).toContain("Bande A"); // ascending on first click
  });

  it("sinks an unknown to the bottom rather than treating it as a good score", async () => {
    const user = userEvent.setup();
    setup([
      row({ productionUnitId: 1, unitName: "Sans IC", feedConversionRatio: null }),
      row({ productionUnitId: 2, unitName: "Avec IC", feedConversionRatio: 1.5 }),
    ]);

    await user.click(screen.getByRole("button", { name: "IC" }));

    expect(bodyNames()[1]).toContain("Sans IC");
  });

  it("warns that a partly valued batch compares too favourably", () => {
    setup([row({ valuationIncomplete: true })]);

    expect(screen.getByText(/leur coût est sous-estimé/i)).toBeInTheDocument();
  });

  it("stays silent when every batch was fully valued", () => {
    setup([row({})]);

    expect(screen.queryByText(/sous-estimé/i)).not.toBeInTheDocument();
  });
});
