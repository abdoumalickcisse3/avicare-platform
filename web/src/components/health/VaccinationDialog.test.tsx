import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { VaccinationDialog } from "./VaccinationDialog";

const today = new Date().toISOString().slice(0, 10);

function setup(currentCount = 500) {
  return renderWithProviders(
    <VaccinationDialog
      open
      onClose={vi.fn()}
      farmId={1}
      unitId={9}
      unitName="Lot Cobb #9"
      currentCount={currentCount}
    />,
  );
}

describe("VaccinationDialog", () => {
  it("shows the unit name and defaults the date to today", () => {
    setup();
    expect(screen.getByText("Lot Cobb #9")).toBeInTheDocument();
    expect(screen.getByLabelText(/date d'administration/i)).toHaveValue(today);
  });

  it("pre-fills the subjects count with the current headcount", () => {
    setup(420);
    expect(screen.getByLabelText(/sujets vaccinés/i)).toHaveValue(420);
    expect(screen.getByText(/effectif actuel : 420/i)).toBeInTheDocument();
  });

  it("requires a vaccine before submitting", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /^enregistrer$/i }));
    expect(await screen.findByText("Vaccin requis")).toBeInTheDocument();
  });
});
