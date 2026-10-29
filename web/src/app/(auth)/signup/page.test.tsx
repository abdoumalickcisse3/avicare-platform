import { describe, expect, it, vi, beforeEach } from "vitest";
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

import SignupPage from "./page";

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/prénom/i), "Awa");
  await user.type(screen.getByLabelText(/^nom$/i), "Diop");
  await user.type(screen.getByLabelText(/adresse e-mail/i), "awa@example.com");
  // Obligatoire depuis le 2026-10-09 : sans numéro, la plateforme ne peut rien signaler.
  await user.type(screen.getByLabelText(/téléphone/i), "771842787");
  await user.type(screen.getByLabelText("Mot de passe"), "password123");
  await user.type(screen.getByLabelText(/confirmation/i), "password123");
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("SignupPage (single-step)", () => {
  it("renders an identity-only form — no farm fields, no plan step", () => {
    renderWithProviders(<SignupPage />);
    expect(screen.getByRole("heading", { name: "Créer votre compte" })).toBeInTheDocument();
    expect(screen.getByLabelText(/prénom/i)).toBeInTheDocument();
    // Farm details moved to the onboarding wizard.
    expect(screen.queryByLabelText(/nom de la ferme/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /créer mon compte/i })).toBeInTheDocument();
    expect(screen.queryByText("Votre formule")).not.toBeInTheDocument();
    expect(screen.queryByText("Starter Volaille")).not.toBeInTheDocument();
  });

  it("blocks submission until the form is valid", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));
    expect(await screen.findByText("Prénom requis")).toBeInTheDocument();
    expect(m.signup).not.toHaveBeenCalled();
  });

  it("déduit le pays du numéro saisi : un numéro ivoirien crée une ferme en CI", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    await user.type(screen.getByLabelText(/prénom/i), "Awa");
    await user.type(screen.getByLabelText(/^nom$/i), "Diop");
    await user.type(screen.getByLabelText(/adresse e-mail/i), "awa@example.com");
    // L'éleveur choisit son pays dans le sélecteur d'indicatif, puis tape son numéro local.
    // C'est ce choix — et non une devinette sur les chiffres — qui porte le pays : s'y fier a
    // déjà coûté dix-huit alertes WhatsApp parties nulle part le 2026-10-02.
    await user.click(screen.getByLabelText(/indicatif pays/i));
    await user.click(await screen.findByRole("option", { name: /côte d'ivoire/i }));
    await user.type(screen.getByLabelText(/téléphone/i), "0102030405");
    await user.type(screen.getByLabelText("Mot de passe"), "password123");
    await user.type(screen.getByLabelText(/confirmation/i), "password123");
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    await waitFor(() =>
      expect(m.createFarm).toHaveBeenCalledWith({ name: "Ferme de Awa", country: "CI" }),
    );
  });

  it("creates the account and a default-named farm, then redirects to onboarding", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    await waitFor(() => expect(m.replace).toHaveBeenCalledWith("/onboarding"));
    expect(m.signup).toHaveBeenCalledTimes(1);
    // Farm is provisioned with a default name derived from the first name;
    // the owner names/details it in the onboarding wizard.
    // Le pays part avec la ferme, déduit du numéro saisi juste au-dessus — ici un sénégalais.
    expect(m.createFarm).toHaveBeenCalledWith({ name: "Ferme de Awa", country: "SN" });
    expect(m.refresh).toHaveBeenCalled();
  });

  it("shows an error and does not redirect when signup fails", async () => {
    m.signup.mockImplementationOnce(() => ({
      unwrap: () => Promise.reject({ data: { title: "Email déjà utilisé" } }),
    }));
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />);
    await fillForm(user);
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
