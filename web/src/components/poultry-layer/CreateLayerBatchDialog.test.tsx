import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { CreateLayerBatchDialog } from "./CreateLayerBatchDialog";

const today = new Date().toISOString().slice(0, 10);

vi.mock("@/store/api/breedsApi", () => ({
  useGetBreedsQuery: () => ({
    data: [
      { id: 1, species: "POULTRY", code: "isa_brown", name: "ISA Brown", type: "layer", farmId: null, active: true },
      { id: 2, species: "POULTRY", code: "lohmann_brown", name: "Lohmann Brown", type: "layer", farmId: null, active: true },
      { id: 3, species: "POULTRY", code: "cobb_500", name: "Cobb 500", type: "broiler", farmId: null, active: true },
    ],
  }),
}));

describe("CreateLayerBatchDialog", () => {
  it("renders the form with today's date", () => {
    renderWithProviders(<CreateLayerBatchDialog open onClose={vi.fn()} farmId={1} />);
    expect(screen.getByText(/créer un nouveau lot de pondeuses/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date d'entrée/i)).toHaveValue(today);
  });

  it("lists only layer strains, never broiler ones", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateLayerBatchDialog open onClose={vi.fn()} farmId={1} />);

    await user.click(screen.getByRole("combobox", { name: /souche de pondeuse/i }));

    expect(await screen.findByRole("option", { name: "ISA Brown" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Lohmann Brown" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Cobb 500" })).not.toBeInTheDocument();
  });

  it("requires a breed and an initial count", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateLayerBatchDialog open onClose={vi.fn()} farmId={1} />);

    await user.click(screen.getByRole("button", { name: /créer le lot/i }));

    expect(await screen.findByText("Souche requise")).toBeInTheDocument();
    expect(screen.getByText("Effectif requis")).toBeInTheDocument();
  });
});
