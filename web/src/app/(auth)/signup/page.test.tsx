import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";

const m = vi.hoisted(() => ({
  replace: vi.fn(),
  signup: vi.fn(() => ({
    unwrap: () => Promise.resolve({ accessToken: "a", refreshToken: "r", expiresIn: 900 }),
  })),
  refresh: vi.fn(() => ({
    unwrap: () => Promise.resolve({ accessToken: "a2", refreshToken: "r2", expiresIn: 900 }),
  })),
  createFarm: vi.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) })),
  applyPlan: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  upsert: vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
  plans: [
    {
      key: "starter_volaille",
      label: "Starter Volaille",
      priceXof: 15000,
      modules: ["module.poultry.broiler", "module.poultry.layer", "module.health.basic"],
      quotas: null,
      recommended: false,
      custom: false,
      wave: "V1",
    },
    {
      key: "pro_volaille",
      label: "Pro Volaille",
      priceXof: 25000,
      modules: ["module.poultry.broiler", "module.poultry.layer", "module.health.advanced"],
      quotas: null,
      recommended: true,
      custom: false,
      wave: "V1",
    },
    {
      key: "ferme_complete",
      label: "Ferme Complète",
      priceXof: 45000,
      modules: [],
      quotas: null,
      recommended: false,
      custom: false,
      wave: "V1",
    },
    {
      key: "sur_mesure",
      label: "Sur mesure",
      priceXof: null,
      modules: [],
      quotas: null,
      recommended: false,
      custom: true,
      wave: "V1",
    },
  ],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: m.replace, push: vi.fn() }),
}));
vi.mock("@/store/api/authApi", () => ({
  useSignupMutation: () => [m.signup, {}],
  useRefreshMutation: () => [m.refresh, {}],
}));
vi.mock("@/store/api/farmsApi", () => ({
  useCreateFarmMutation: () => [m.createFarm, {}],
}));
vi.mock("@/store/api/subscriptionApi", () => ({
  useGetPlansQuery: () => ({ data: m.plans }),
  useApplyPlanMutation: () => [m.applyPlan, {}],
}));
vi.mock("@/store/api/accountSettingsApi", () => ({
  ONBOARDING_SETTING_KEY: "onboarding_completed",
  useUpsertSettingMutation: () => [m.upsert, {}],
}));

import SignupPage from "./page";

async function fillStep1(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/prénom/i), "Awa");
  await user.type(screen.getByLabelText(/^nom$/i), "Diop");
  await user.type(screen.getByLabelText(/adresse e-mail/i), "awa@example.com");
  await user.type(screen.getByLabelText("Mot de passe"), "password123");
  await user.type(screen.getByLabelText(/confirmation/i), "password123");
  await user.type(screen.getByLabelText(/nom de la ferme/i), "Ferme Test");
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("SignupPage (2-step wizard)", () => {
  it("renders step 1 with identity and farm fields", () => {
    renderWithProviders(<SignupPage />);
    expect(screen.getByRole("heading", { name: "Créer votre compte" })).toBeInTheDocument();
    expect(screen.getByLabelText(/prénom/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nom de la ferme/i)).toBeInTheDocument();
    expect(screen.queryByText("Starter Volaille")).not.toBeInTheDocument();
  });

  it("blocks step 2 until step 1 is valid", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    await user.click(screen.getByRole("button", { name: /continuer/i }));
    expect(await screen.findByText("Prénom requis")).toBeInTheDocument();
    expect(screen.getByText("Nom de la ferme requis")).toBeInTheDocument();
    expect(screen.queryByText("Starter Volaille")).not.toBeInTheDocument();
  });

  it("navigates to step 2 and back", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    await fillStep1(user);
    await user.click(screen.getByRole("button", { name: /continuer/i }));
    expect(await screen.findByText("Starter Volaille")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retour/i }));
    expect(screen.getByRole("button", { name: /continuer/i })).toBeInTheDocument();
  });

  it("requires a plan before submitting", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    await fillStep1(user);
    await user.click(screen.getByRole("button", { name: /continuer/i }));
    await screen.findByText("Starter Volaille");
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));
    expect(await screen.findByText(/veuillez sélectionner une formule/i)).toBeInTheDocument();
    expect(m.signup).not.toHaveBeenCalled();
  });

  it("orchestrates signup → farm → modules → setting → onboarding", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    await fillStep1(user);
    await user.click(screen.getByRole("button", { name: /continuer/i }));
    await user.click(await screen.findByText("Pro Volaille"));
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    await waitFor(() => expect(m.replace).toHaveBeenCalledWith("/onboarding"));
    expect(m.signup).toHaveBeenCalledTimes(1);
    expect(m.createFarm).toHaveBeenCalledWith({ name: "Ferme Test", location: undefined });
    // Backend resolves the plan's modules — frontend just applies the plan key.
    expect(m.applyPlan).toHaveBeenCalledWith({ farmId: 1, planKey: "pro_volaille" });
    expect(m.upsert).toHaveBeenCalledWith({
      key: "onboarding_completed",
      value: { completed: true },
    });
  });

  it("shows an error and does not redirect when signup fails", async () => {
    m.signup.mockImplementationOnce(() => ({
      unwrap: () => Promise.reject({ data: { title: "Email déjà utilisé" } }),
    }));
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    await fillStep1(user);
    await user.click(screen.getByRole("button", { name: /continuer/i }));
    await user.click(await screen.findByText("Starter Volaille"));
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    expect(await screen.findByText("Email déjà utilisé")).toBeInTheDocument();
    expect(m.replace).not.toHaveBeenCalled();
    expect(m.createFarm).not.toHaveBeenCalled();
  });

  it("redirects to the dashboard if already authenticated", () => {
    localStorage.setItem("avicare_access_token", "existing");
    renderWithProviders(<SignupPage />);
    expect(m.replace).toHaveBeenCalledWith("/dashboard");
  });
});

describe("SignupPage (dev gating bypass)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips the plan step and creates the account directly when gating is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURES_GATING", "off");
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);

    // No stepper / no plan cards — single "Créer mon compte" action on step 1.
    expect(screen.queryByText("Votre formule")).not.toBeInTheDocument();
    await fillStep1(user);
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    await waitFor(() => expect(m.replace).toHaveBeenCalledWith("/onboarding"));
    expect(screen.queryByText("Starter Volaille")).not.toBeInTheDocument();
    expect(m.signup).toHaveBeenCalledTimes(1);
    expect(m.createFarm).toHaveBeenCalledWith({ name: "Ferme Test", location: undefined });
    // Dev bypass applies the full "Ferme Complète" plan.
    expect(m.applyPlan).toHaveBeenCalledWith({ farmId: 1, planKey: "ferme_complete" });
  });
});
