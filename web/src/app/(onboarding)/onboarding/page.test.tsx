import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";

const createFarm = vi.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) }));
const enableModule = vi.fn(() => ({ unwrap: () => Promise.resolve({}) }));
const upsertSetting = vi.fn(() => ({ unwrap: () => Promise.resolve({}) }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/store/api/farmsApi", () => ({
  useGetMyFarmsQuery: () => ({ data: [], isLoading: false }),
  useCreateFarmMutation: () => [createFarm, { isLoading: false }],
}));

vi.mock("@/store/api/subscriptionApi", () => ({
  useGetSubscriptionQuery: () => ({ data: undefined, isLoading: false }),
  useEnableModuleMutation: () => [enableModule, { isLoading: false }],
}));

vi.mock("@/store/api/accountSettingsApi", () => ({
  ONBOARDING_SETTING_KEY: "onboarding_completed",
  isOnboardingCompleted: () => false,
  useGetAccountSettingsQuery: () => ({ data: [], isLoading: false }),
  useUpsertSettingMutation: () => [upsertSetting, { isLoading: false }],
}));

import OnboardingPage from "./page";

describe("OnboardingPage", () => {
  it("starts at step 1 with the livestock type choices", async () => {
    renderWithProviders(<OnboardingPage />);
    expect(await screen.findByText("Votre exploitation")).toBeInTheDocument();
    expect(screen.getByText("Poulets de chair")).toBeInTheDocument();
    expect(screen.getByText("Poules pondeuses")).toBeInTheDocument();
    expect(screen.getByText("Mixte")).toBeInTheDocument();
  });

  it("validates type and name before advancing", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OnboardingPage />);
    await screen.findByText("Votre exploitation");

    await user.click(screen.getByRole("button", { name: /continuer/i }));

    expect(
      await screen.findByText(/veuillez choisir un type/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Nom requis")).toBeInTheDocument();
    expect(createFarm).not.toHaveBeenCalled();
  });

  it("creates the farm and advances to the bundle step", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OnboardingPage />);
    await screen.findByText("Votre exploitation");

    await user.click(screen.getByText("Poulets de chair"));
    await user.type(screen.getByLabelText(/nom de la ferme/i), "Ferme Test");
    await user.click(screen.getByRole("button", { name: /continuer/i }));

    expect(await screen.findByText("Votre formule")).toBeInTheDocument();
    expect(createFarm).toHaveBeenCalledWith({
      name: "Ferme Test",
      location: undefined,
    });
  });
});
