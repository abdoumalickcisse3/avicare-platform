import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { DailyRecordDialog } from "./DailyRecordDialog";

const today = new Date().toISOString().slice(0, 10);

function setup(existingDates: string[] = []) {
  return renderWithProviders(
    <DailyRecordDialog
      open
      onClose={vi.fn()}
      farmId={1}
      batchId={9}
      currentCount={4870}
      existingDates={existingDates}
    />,
  );
}

describe("DailyRecordDialog", () => {
  it("shows the current count and defaults the date to today", () => {
    setup();
    expect(screen.getByText(/effectif actuel/i)).toHaveTextContent("4");
    expect(screen.getByLabelText(/date de la saisie/i)).toHaveValue(today);
  });

  it("requires an integer mortality count", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(await screen.findByText("Nombre entier requis")).toBeInTheDocument();
  });

  it("warns that an existing entry for the date will be updated", () => {
    setup([today]);
    expect(screen.getByText(/elle sera mise à jour/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mettre à jour/i })).toBeInTheDocument();
  });
});
