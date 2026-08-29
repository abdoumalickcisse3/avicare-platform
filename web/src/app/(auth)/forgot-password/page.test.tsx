import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import ForgotPasswordPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
}));

function mockApi(confirmStatus = 200) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push(url);
      if (url.includes("/confirm")) {
        return new Response(
          JSON.stringify(
            confirmStatus === 200
              ? { data: { message: "ok" } }
              : {
                  // The real shape the backend sends: parseApiError needs `title` to recognise it.
                  type: "https://avicare.com/errors/reset-code-invalid",
                  title: "Reset Code Invalid",
                  status: 422,
                  detail: "Code invalide ou expiré. Demandez un nouveau code.",
                  code: "RESET_CODE_INVALID",
                },
          ),
          { status: confirmStatus, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ data: { message: "envoyé" } }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

async function askForCode() {
  await userEvent.type(screen.getByLabelText("Numéro de téléphone"), "770000001");
  await userEvent.click(screen.getByRole("button", { name: /recevoir un code/i }));
}

beforeEach(() => replace.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("ForgotPasswordPage", () => {
  it("moves to the code step whatever the server says", async () => {
    mockApi();
    renderWithProviders(<ForgotPasswordPage />);
    await askForCode();

    // The server answers the same for a known and an unknown number, and so must the screen —
    // otherwise it leaks who is registered.
    expect(await screen.findByLabelText("Code à 6 chiffres")).toBeInTheDocument();
    expect(screen.getByText(/Si un compte est associé à ce numéro/)).toBeInTheDocument();
  });

  it("resets the password and returns to the login", async () => {
    mockApi();
    renderWithProviders(<ForgotPasswordPage />);
    await askForCode();

    await userEvent.type(await screen.findByLabelText("Code à 6 chiffres"), "123456");
    await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), "NouveauPass1");
    await userEvent.click(screen.getByRole("button", { name: /changer mon mot de passe/i }));

    expect(await screen.findByText(/Mot de passe modifié/)).toBeInTheDocument();
  });

  it("shows the server message on a bad code", async () => {
    mockApi(422);
    renderWithProviders(<ForgotPasswordPage />);
    await askForCode();

    await userEvent.type(await screen.findByLabelText("Code à 6 chiffres"), "000000");
    await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), "NouveauPass1");
    await userEvent.click(screen.getByRole("button", { name: /changer mon mot de passe/i }));

    expect(await screen.findByText(/Code invalide ou expiré/)).toBeInTheDocument();
  });

  it("tells accounts without a phone number where to go", async () => {
    mockApi();
    renderWithProviders(<ForgotPasswordPage />);

    // They are not stranded — but only if the screen says so.
    expect(screen.getByText(/Pas de numéro enregistré/)).toBeInTheDocument();
  });

  it("lets the farmer go back and correct the number", async () => {
    mockApi();
    renderWithProviders(<ForgotPasswordPage />);
    await askForCode();

    await userEvent.click(await screen.findByRole("button", { name: /changer de numéro/i }));

    expect(screen.getByLabelText("Numéro de téléphone")).toBeInTheDocument();
  });
});
