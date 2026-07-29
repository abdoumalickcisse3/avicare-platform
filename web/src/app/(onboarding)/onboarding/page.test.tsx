import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import OnboardingPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("OnboardingPage", () => {
  it("mounts the guided setup wizard on its welcome panel", () => {
    renderWithProviders(<OnboardingPage />);
    expect(
      screen.getByText("On configure votre ferme ensemble"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuer/i })).toBeInTheDocument();
  });
});
