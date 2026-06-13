import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { TreatmentDialog } from "./TreatmentDialog";

function setup() {
  return renderWithProviders(
    <TreatmentDialog
      open
      onClose={vi.fn()}
      farmId={1}
      unitId={9}
      unitName="Lot #9"
      currentCount={300}
    />,
  );
}

describe("TreatmentDialog", () => {
  it("always shows the orange withdrawal notice (informational, never blocking)", () => {
    setup();
    expect(screen.getByText(/Alerte sanitaire — délai d'attente/i)).toBeInTheDocument();
    // No treatment selected yet => unknown official delay
    expect(screen.getByText(/Aucun délai d'attente officiel renseigné/i)).toBeInTheDocument();
  });

  it("requires a treatment before submitting", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /enregistrer le traitement/i }));
    expect(await screen.findByText("Traitement requis")).toBeInTheDocument();
  });
});
