import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { OnboardingWizard } from "./OnboardingWizard";
import { ONBOARDING_STEPS } from "./onboardingSteps";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  replace.mockReset();
});

describe("OnboardingWizard", () => {
  it("renders the full seven-step rail", () => {
    renderWithProviders(<OnboardingWizard />);
    for (const step of ONBOARDING_STEPS) {
      // Labels appear in the rail (and the mobile progress line).
      expect(screen.getAllByText(step.label).length).toBeGreaterThan(0);
    }
  });

  it("opens on the welcome panel with an active CTA", () => {
    renderWithProviders(<OnboardingWizard />);
    expect(
      screen.getByText("On configure votre ferme ensemble"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuer/i })).toBeEnabled();
  });

  it("advances from welcome to the farm panel", () => {
    renderWithProviders(<OnboardingWizard />);
    fireEvent.click(screen.getByRole("button", { name: /Continuer/i }));
    expect(
      screen.getByText("Parlez-nous de votre ferme"),
    ).toBeInTheDocument();
  });
});
