import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LayingRateCurve } from "./LayingRateCurve";
import { Production7dChart } from "./Production7dChart";
import { GradesDistributionChart } from "./GradesDistributionChart";
import type { DailyProduction } from "@/types";

const production: DailyProduction = {
  unitId: 9,
  productionDate: "2026-06-09",
  totalEggsCollected: 800,
  totalBrokenEggs: 10,
  gradesAggregate: { S: 100, M: 400, L: 300 },
  layingRatePct: 80,
  breakRatePct: 1.23,
  activeLayersCount: 1000,
  closedAt: "2026-06-09T18:00:00",
  closedById: 1,
};

describe("layer charts", () => {
  it("LayingRateCurve shows an empty state without rated days", () => {
    render(<LayingRateCurve productions={[]} />);
    expect(screen.getByText(/clôturez une journée/i)).toBeInTheDocument();
  });

  it("Production7dChart shows an empty state without productions", () => {
    render(<Production7dChart productions={[]} />);
    expect(screen.getByText(/aucune journée clôturée/i)).toBeInTheDocument();
  });

  it("GradesDistributionChart shows an empty state without grades", () => {
    render(<GradesDistributionChart gradesCount={{}} />);
    expect(screen.getByText(/aucune répartition/i)).toBeInTheDocument();
  });

  it("renders with data without throwing", () => {
    expect(() => render(<LayingRateCurve productions={[production]} />)).not.toThrow();
    expect(() => render(<Production7dChart productions={[production]} />)).not.toThrow();
    expect(() =>
      render(<GradesDistributionChart gradesCount={production.gradesAggregate} />),
    ).not.toThrow();
  });
});
