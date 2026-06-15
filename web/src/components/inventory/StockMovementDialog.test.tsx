import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { StockMovementDialog } from "./StockMovementDialog";

describe("StockMovementDialog", () => {
  it("offers the three movement types, IN by default", () => {
    renderWithProviders(<StockMovementDialog open onClose={vi.fn()} farmId={1} />);
    expect(screen.getByText("Entrée")).toBeInTheDocument();
    expect(screen.getByText("Sortie")).toBeInTheDocument();
    expect(screen.getByText("Ajustement")).toBeInTheDocument();
    // IN shows the unit-price field.
    expect(screen.getByLabelText(/prix unitaire/i)).toBeInTheDocument();
  });

  it("switches the quantity label and hides unit price for an adjustment", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StockMovementDialog open onClose={vi.fn()} farmId={1} />);
    expect(screen.getByLabelText(/^quantité$/i)).toBeInTheDocument();

    await user.click(screen.getByText("Ajustement"));
    expect(screen.getByLabelText(/quantité comptée/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/prix unitaire/i)).not.toBeInTheDocument();
  });
});
