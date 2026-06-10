import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { defaultTimeslotForNow } from "@/lib/layer";
import { EggCollectionDialog } from "./EggCollectionDialog";

const today = new Date().toISOString().slice(0, 10);
const TIMESLOTS = ["morning", "noon", "evening"];
const GRADES = ["S", "M", "L", "XL"];

function setup(existingKeys: string[] = []) {
  return renderWithProviders(
    <EggCollectionDialog
      open
      onClose={vi.fn()}
      farmId={1}
      unitId={9}
      unitName="Pondeuses A"
      timeslots={TIMESLOTS}
      grades={GRADES}
      existingKeys={existingKeys}
    />,
  );
}

describe("EggCollectionDialog", () => {
  it("shows the unit name and defaults the date to today", () => {
    setup();
    expect(screen.getByText("Pondeuses A")).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toHaveValue(today);
  });

  it("clarifies that broken eggs are counted separately", () => {
    setup();
    expect(screen.getByText(/non inclus dans le total/i)).toBeInTheDocument();
  });

  it("requires an integer total", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(await screen.findByText("Nombre entier requis")).toBeInTheDocument();
  });

  it("shows the remaining-to-distribute badge", () => {
    setup();
    expect(screen.getByText(/reste à répartir/i)).toBeInTheDocument();
  });

  it("warns that an existing collection for the slot will be updated", () => {
    const slot = defaultTimeslotForNow(TIMESLOTS);
    setup([`${today}|${slot}`]);
    expect(screen.getByText(/elle sera mise à jour/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mettre à jour/i })).toBeInTheDocument();
  });
});
