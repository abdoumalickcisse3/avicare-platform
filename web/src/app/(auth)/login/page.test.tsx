import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import LoginPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

describe("LoginPage", () => {
  it("renders the login form", () => {
    renderWithProviders(<LoginPage />);
    expect(
      screen.getByRole("heading", { name: "Bienvenue" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByText("Adresse e-mail ou numéro requis")).toBeInTheDocument();
    expect(await screen.findByText("Mot de passe requis")).toBeInTheDocument();
  });

  /**
   * The email shape check was deliberately dropped on 2026-10-08: the field carries an identifier
   * now, and a phone number has no '@'. Refusing a number the server would have accepted is a
   * worse error than letting a typo reach the server, which answers "invalid credentials" anyway
   * — and on a sign-in form that generic answer is the right one regardless.
   */
  it("laisse passer un numéro de téléphone, qui n'est pas une adresse", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/adresse e-mail ou numéro/i), "771842787");
    await user.type(screen.getByLabelText("Mot de passe"), "secret123");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(screen.queryByText(/invalide/i)).not.toBeInTheDocument();
  });
});
