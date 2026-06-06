import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import SignupPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

describe("SignupPage", () => {
  it("renders the signup form without a farm name field", () => {
    renderWithProviders(<SignupPage />);
    expect(
      screen.getByRole("heading", { name: "Créer un compte" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/nom complet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/téléphone/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/ferme/i)).not.toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);

    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    expect(await screen.findByText("Nom complet requis")).toBeInTheDocument();
    expect(await screen.findByText("Adresse e-mail invalide")).toBeInTheDocument();
  });

  it("enforces an 8-character minimum password", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);

    await user.type(screen.getByLabelText(/nom complet/i), "Awa Diop");
    await user.type(screen.getByLabelText(/adresse e-mail/i), "awa@example.com");
    await user.type(screen.getByLabelText(/mot de passe/i), "short");
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    expect(await screen.findByText("8 caractères minimum")).toBeInTheDocument();
  });
});
