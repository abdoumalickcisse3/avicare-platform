import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { WeighingDialog } from "./WeighingDialog";

function setup() {
  return renderWithProviders(
    <WeighingDialog open onClose={vi.fn()} farmId={1} batchId={9} />,
  );
}

describe("WeighingDialog", () => {
  it("computes live stats from the entered weights", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText(/poids individuels/i), "1800, 2000, 2200");

    const preview = await screen.findByText(/3 sujets pesés/i);
    const panel = preview.parentElement as HTMLElement;
    // mean = 2000, min = 1800, max = 2200
    expect(within(panel).getByText("2000")).toBeInTheDocument();
    expect(within(panel).getByText("1800")).toBeInTheDocument();
    expect(within(panel).getByText("2200")).toBeInTheDocument();
  });

  it("requires at least two weights", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText(/poids individuels/i), "1800");
    await user.click(screen.getByRole("button", { name: /enregistrer la pesée/i }));

    expect(await screen.findByText("Saisissez au moins 2 poids")).toBeInTheDocument();
  });
});
