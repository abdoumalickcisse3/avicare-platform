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

    expect(await screen.findByText("Identifiant requis")).toBeInTheDocument();
    expect(await screen.findByText("Mot de passe requis")).toBeInTheDocument();
  });

  /**
   * The email shape check was deliberately dropped on 2026-10-08: the field carries an identifier
   * now, and a phone number has no '@'. On a sign-in form the server's generic "invalid
   * credentials" is the right answer anyway.
   *
   * <p>The tab added on 2026-10-09 is what makes a NUMBER actually usable: without it the field
   * can only guess a country, and a Beninese worker typing 01 56 34 34 08 would be looked up as
   * +221156343408 — nobody.
   */
  it("bascule sur le numéro, montre l'indicatif, et vide ce qui était tapé", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/adresse e-mail/i), "awa@jawdi.app");
    await user.click(screen.getByLabelText("Identifiant par numéro"));

    expect(screen.getByText("🇸🇳 +221")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("awa@jawdi.app")).not.toBeInTheDocument();
  });

});
