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
      screen.getByRole("heading", { name: "Créer votre compte" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/prénom/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^nom$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/téléphone/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/ferme/i)).not.toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);

    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    expect(await screen.findByText("Prénom requis")).toBeInTheDocument();
    expect(await screen.findByText("Adresse e-mail invalide")).toBeInTheDocument();
  });

  it("rejects mismatched password confirmation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);

    await user.type(screen.getByLabelText(/prénom/i), "Awa");
    await user.type(screen.getByLabelText(/^nom$/i), "Diop");
    await user.type(screen.getByLabelText(/adresse e-mail/i), "awa@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "password123");
    await user.type(screen.getByLabelText(/confirmation/i), "different456");
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    expect(
      await screen.findByText("Les mots de passe ne correspondent pas"),
    ).toBeInTheDocument();
  });
});
