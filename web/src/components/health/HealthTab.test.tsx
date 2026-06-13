import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";

const gatingMock = vi.fn();
vi.mock("@/hooks/useHealthGating", () => ({
  useHealthGating: () => gatingMock(),
}));

import { HealthTab } from "./HealthTab";

function setup() {
  renderWithProviders(
    <HealthTab
      farmId={1}
      unitId={9}
      unitName="Lot #9"
      breedId={3}
      startDate="2026-01-01"
      currentCount={300}
    />,
  );
}

describe("HealthTab conditional rendering", () => {
  beforeEach(() => {
    gatingMock.mockReset();
  });

  it("shows treatment and vet sections when health.advanced is active", () => {
    gatingMock.mockReturnValue({ hasAdvanced: true, hasBasic: true, hasHealth: true });
    setup();
    expect(screen.getByText("Traitements")).toBeInTheDocument();
    expect(screen.getByText("Visites vétérinaires")).toBeInTheDocument();
    expect(screen.queryByText(/module avancé/i)).not.toBeInTheDocument();
  });

  it("hides advanced sections and shows the upgrade CTA when inactive", () => {
    gatingMock.mockReturnValue({ hasAdvanced: false, hasBasic: true, hasHealth: true });
    setup();
    expect(screen.getByText("Traitements — module avancé")).toBeInTheDocument();
    expect(screen.getByText("Vétérinaires — module avancé")).toBeInTheDocument();
    // Basic sections still present (observations always shown).
    expect(screen.getByText("Observations")).toBeInTheDocument();
  });
});
