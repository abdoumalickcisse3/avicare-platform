import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { TrayStockDialog } from "./TrayStockDialog";
import type { TrayStock } from "@/types";

const stock: TrayStock = {
  farmId: 1,
  fullTraysCount: 12,
  emptyTraysCount: 3,
  updatedAt: "2026-06-09T10:00:00",
};

function setup() {
  return renderWithProviders(
    <TrayStockDialog open onClose={vi.fn()} farmId={1} current={stock} />,
  );
}

describe("TrayStockDialog", () => {
  it("starts in adjust mode with empty delta fields", () => {
    setup();
    expect(screen.getByLabelText(/pleins \(±\)/i)).toHaveValue(null);
    expect(screen.getByText(/ajoutez ou retirez/i)).toBeInTheDocument();
  });

  it("prefills current counts when switching to 'Définir'", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /définir/i }));
    expect(screen.getByLabelText(/^pleins$/i)).toHaveValue(12);
    expect(screen.getByLabelText(/^vides$/i)).toHaveValue(3);
  });
});
