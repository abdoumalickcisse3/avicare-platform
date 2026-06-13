import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { VaccinationCalendar } from "./VaccinationCalendar";
import type { VaccinationScheduleStatus } from "@/types";

const SCHEDULE: VaccinationScheduleStatus[] = [
  { vaccineKey: "newcastle_vh", ageValue: 1, ageUnit: "DAY", dueDate: "2026-01-01", status: "DONE", mandatory: true },
  { vaccineKey: "gumboro_228e", ageValue: 14, ageUnit: "DAY", dueDate: "2026-01-14", status: "LATE", mandatory: true },
  { vaccineKey: "ib_h120", ageValue: 28, ageUnit: "DAY", dueDate: "2026-01-29", status: "UPCOMING", mandatory: false },
];

function setup(onSelect = vi.fn()) {
  renderWithProviders(
    <VaccinationCalendar
      schedule={SCHEDULE}
      startDate="2026-01-01"
      currentAgeDays={20}
      onSelectEntry={onSelect}
    />,
  );
  return onSelect;
}

describe("VaccinationCalendar", () => {
  it("renders the today marker with the current lot age", () => {
    setup();
    expect(screen.getByText(/Aujourd'hui \(J20\)/)).toBeInTheDocument();
  });

  it("shows a card per scheduled dose (one button per vaccine)", () => {
    setup();
    // Cards expose a tooltip aria-label; axis ticks also render Jn text, so we
    // target the interactive cards specifically.
    expect(screen.getByRole("button", { name: /Newcastle Vh/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gumboro 228e/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ib H120/ })).toBeInTheDocument();
  });

  it("renders the status legend (Effectué / À venir / En retard)", () => {
    setup();
    expect(screen.getByText("Effectué")).toBeInTheDocument();
    expect(screen.getByText("À venir")).toBeInTheDocument();
    expect(screen.getByText("En retard")).toBeInTheDocument();
  });

  it("invokes onSelectEntry with the clicked dose", async () => {
    const user = userEvent.setup();
    const onSelect = setup();
    const card = screen.getByRole("button", { name: /Ib H120/ });
    await user.click(card);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ vaccineKey: "ib_h120", status: "UPCOMING" }),
    );
  });
});
