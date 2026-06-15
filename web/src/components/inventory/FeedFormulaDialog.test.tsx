import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { FeedFormulaDialog } from "./FeedFormulaDialog";

describe("FeedFormulaDialog", () => {
  it("renders the composition section with a percentage field", () => {
    renderWithProviders(<FeedFormulaDialog open onClose={vi.fn()} farmId={1} />);
    expect(screen.getByText(/composition/i)).toBeInTheDocument();
    expect(screen.getByLabelText("%")).toBeInTheDocument();
    expect(screen.getByText("0.0 %")).toBeInTheDocument();
  });

  it("recomputes the percentage sum as ingredients change", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FeedFormulaDialog open onClose={vi.fn()} farmId={1} />);
    await user.type(screen.getByLabelText("%"), "60");
    expect(screen.getByText("60.0 %")).toBeInTheDocument();
  });
});
