import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { HealthOverviewKpis } from "./HealthOverviewKpis";
import type { HealthAlerts } from "@/types";

const EMPTY: HealthAlerts = {
  vaccinationsLate: [],
  activeWithdrawals: [],
  upcomingFollowUps: [],
  criticalObservations: [],
};

describe("HealthOverviewKpis", () => {
  it("renders the four KPI labels", () => {
    renderWithProviders(<HealthOverviewKpis alerts={EMPTY} isLoading={false} />);
    expect(screen.getByText("Vaccins en attente")).toBeInTheDocument();
    expect(screen.getByText("Traitements actifs")).toBeInTheDocument();
    expect(screen.getByText("Délais d'attente")).toBeInTheDocument();
    expect(screen.getByText("Prochaine visite véto")).toBeInTheDocument();
  });

  it("shows empty-state values when there are no alerts", () => {
    renderWithProviders(<HealthOverviewKpis alerts={EMPTY} isLoading={false} />);
    expect(screen.getByText("À jour")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("counts late vaccinations and active withdrawals", () => {
    const alerts: HealthAlerts = {
      ...EMPTY,
      vaccinationsLate: [
        { unitId: 1, unitName: "A", vaccineKey: "x", dueDate: "2026-01-01", daysLate: 3 },
      ],
      activeWithdrawals: [
        {
          unitId: 1,
          treatmentId: 9,
          treatmentKey: "amox",
          withdrawalEndDateMeat: "2026-02-01",
          withdrawalEndDateEggs: null,
          daysRemainingMeat: 4,
          daysRemainingEggs: null,
        },
      ],
    };
    renderWithProviders(<HealthOverviewKpis alerts={alerts} isLoading={false} />);
    expect(screen.getByText("Doses en retard")).toBeInTheDocument();
    expect(screen.getByText("J-4")).toBeInTheDocument(); // min withdrawal days remaining
  });

  it("renders skeletons while loading", () => {
    const { container } = renderWithProviders(<HealthOverviewKpis isLoading />);
    expect(container.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(0);
  });
});
