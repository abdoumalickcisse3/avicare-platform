import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ObservationDialog } from "./ObservationDialog";

function setup() {
  return renderWithProviders(
    <ObservationDialog open onClose={vi.fn()} farmId={1} unitId={9} unitName="Lot #9" />,
  );
}

describe("ObservationDialog", () => {
  it("renders the three severity choices", () => {
    setup();
    expect(screen.getByRole("button", { name: "Normal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vigilance" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Critique" })).toBeInTheDocument();
  });

  it("defaults severity to NORMAL (pressed)", () => {
    setup();
    expect(screen.getByRole("button", { name: "Normal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("requires a title before submitting", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /^enregistrer$/i }));
    expect(await screen.findByText("Titre requis")).toBeInTheDocument();
  });
});
