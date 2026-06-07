import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { CreateBatchDialog } from "./CreateBatchDialog";

const today = new Date().toISOString().slice(0, 10);

describe("CreateBatchDialog", () => {
  it("renders the create form with smart default targets and today's date", () => {
    renderWithProviders(<CreateBatchDialog open onClose={vi.fn()} farmId={1} />);
    expect(screen.getByText(/créer un nouveau lot/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date d'arrivée/i)).toHaveValue(today);
    expect(screen.getByLabelText(/poids cible/i)).toHaveValue(2000);
    expect(screen.getByLabelText(/âge cible/i)).toHaveValue(42);
  });

  it("requires a breed and an initial count", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateBatchDialog open onClose={vi.fn()} farmId={1} />);

    await user.click(screen.getByRole("button", { name: /créer le lot/i }));

    expect(await screen.findByText("Souche requise")).toBeInTheDocument();
    expect(screen.getByText("Effectif requis")).toBeInTheDocument();
  });
});
