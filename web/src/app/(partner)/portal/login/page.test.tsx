import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { partnerTokenStorage } from "@/lib/partnerStorage";
import PartnerLoginPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
}));

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
}

beforeEach(() => {
  replace.mockClear();
  partnerTokenStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("PartnerLoginPage", () => {
  it("stores partner tokens and redirects on successful login", async () => {
    mockFetch(200, { data: { accessToken: "a", refreshToken: "r", expiresIn: 900 } });
    renderWithProviders(<PartnerLoginPage />);

    await userEvent.type(screen.getByLabelText("Adresse e-mail"), "p@x.io");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "secret");
    await userEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    await waitFor(() => expect(partnerTokenStorage.getAccess()).toBe("a"));
    expect(replace).toHaveBeenCalledWith("/portal");
  });

  it("shows an error message on 401", async () => {
    mockFetch(401, { detail: "Invalid credentials" });
    renderWithProviders(<PartnerLoginPage />);

    await userEvent.type(screen.getByLabelText("Adresse e-mail"), "p@x.io");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "bad");
    await userEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByText(/identifiants invalides/i)).toBeInTheDocument();
    expect(partnerTokenStorage.getAccess()).toBeNull();
  });
});
