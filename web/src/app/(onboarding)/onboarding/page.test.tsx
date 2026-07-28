import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import OnboardingPage from "./page";

describe("OnboardingPage (light)", () => {
  it("shows the welcome screen with the first-batch placeholder", () => {
    renderWithProviders(<OnboardingPage />);
    expect(screen.getByText(/bienvenue sur jawdi/i)).toBeInTheDocument();
    expect(
      screen.getByText(/la création de lots sera disponible/i),
    ).toBeInTheDocument();
  });

  it("links to the dashboard", () => {
    renderWithProviders(<OnboardingPage />);
    expect(
      screen.getByRole("link", { name: /aller au tableau de bord/i }),
    ).toHaveAttribute("href", "/dashboard");
  });
});
