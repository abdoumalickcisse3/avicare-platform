import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GrowthChart } from "./GrowthChart";
import { MortalityChart } from "./MortalityChart";
import { FeedConsumptionChart } from "./FeedConsumptionChart";
import type { PoultryDailyRecord, WeighingSample } from "@/types";

const weighing: WeighingSample = {
  id: 1,
  poultryBatchId: 9,
  sampleDate: "2026-05-20",
  ageDays: 19,
  sampleSize: 10,
  avgWeightG: 820,
  minWeightG: 760,
  maxWeightG: 910,
  stdDeviation: 42.1,
  uniformityPercent: 80,
  notes: null,
};

const record: PoultryDailyRecord = {
  id: 1,
  productionUnitId: 9,
  recordDate: "2026-05-20",
  mortalityCount: 3,
  feedKg: 12.5,
  waterL: 25,
  observations: null,
};

describe("poultry charts", () => {
  it("GrowthChart shows an empty state without weighings", () => {
    render(<GrowthChart weighings={[]} targetWeightG={2100} targetAgeDays={42} />);
    expect(screen.getByText(/ajoutez une pesée/i)).toBeInTheDocument();
  });

  it("MortalityChart shows an empty state without records", () => {
    render(<MortalityChart records={[]} />);
    expect(screen.getByText(/aucune saisie/i)).toBeInTheDocument();
  });

  it("FeedConsumptionChart shows an empty state without records", () => {
    render(<FeedConsumptionChart records={[]} />);
    expect(screen.getByText(/aucune saisie/i)).toBeInTheDocument();
  });

  it("renders with data without throwing", () => {
    expect(() =>
      render(<GrowthChart weighings={[weighing]} targetWeightG={2100} targetAgeDays={42} />),
    ).not.toThrow();
    expect(() => render(<MortalityChart records={[record]} />)).not.toThrow();
    expect(() => render(<FeedConsumptionChart records={[record]} />)).not.toThrow();
  });
});
