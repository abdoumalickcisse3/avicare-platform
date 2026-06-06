import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { CreateFarmDialog } from "./CreateFarmDialog";

describe("CreateFarmDialog", () => {
  it("renders the create form fields", () => {
    renderWithProviders(<CreateFarmDialog open onClose={vi.fn()} />);
    expect(screen.getByText("Créer une nouvelle ferme")).toBeInTheDocument();
    expect(screen.getByLabelText(/nom de la ferme/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/localisation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/capacité/i)).toBeInTheDocument();
  });

  it("requires a name on submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateFarmDialog open onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /créer la ferme/i }));

    expect(await screen.findByText("Nom requis")).toBeInTheDocument();
  });

  it("rejects a non-numeric capacity", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateFarmDialog open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/nom de la ferme/i), "Ferme A");
    await user.type(screen.getByLabelText(/capacité/i), "abc");
    await user.click(screen.getByRole("button", { name: /créer la ferme/i }));

    expect(await screen.findByText("Saisissez un nombre")).toBeInTheDocument();
  });
});
