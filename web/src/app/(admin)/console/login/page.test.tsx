import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { tokenStorage } from "@/lib/storage";
import ConsoleLoginPage from "./page";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
}));

/** Answers the login, then /admin/me with the given status. */
function mockAuth(loginStatus: number, meStatus: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/admin/me")) {
        return new Response(
          JSON.stringify(
            meStatus === 200
              ? { data: { userId: 1, email: "s@jawdi.app", fullName: "S", permissions: ["*"], superAdmin: true } }
              : { detail: "Forbidden" },
          ),
          { status: meStatus, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ data: { accessToken: "a", refreshToken: "r", expiresIn: 900 } }),
        { status: loginStatus, headers: { "Content-Type": "application/json" } },
      );
    }),
  );
}

async function submit() {
  await userEvent.type(screen.getByLabelText("Adresse e-mail"), "s@jawdi.app");
  await userEvent.type(screen.getByLabelText("Mot de passe"), "secret");
  await userEvent.click(screen.getByRole("button", { name: /se connecter/i }));
}

beforeEach(() => {
  replace.mockClear();
  adminTokenStorage.clear();
  tokenStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("ConsoleLoginPage", () => {
  it("stores the staff token under its own keys and enters the console", async () => {
    mockAuth(200, 200);
    renderWithProviders(<ConsoleLoginPage />);
    await submit();

    await waitFor(() => expect(adminTokenStorage.getAccess()).toBe("a"));
    expect(replace).toHaveBeenCalledWith("/console");
    // Three sessions coexist in one browser: the staff token must not touch the farmer store.
    expect(tokenStorage.getAccess()).toBeNull();
  });

  it("refuses an account that is not staff, and keeps no token", async () => {
    // Valid credentials, but /admin/me says 403: a farmer who knows the URL must not get in.
    mockAuth(200, 403);
    renderWithProviders(<ConsoleLoginPage />);
    await submit();

    expect(await screen.findByText(/n'a pas accès à la console/i)).toBeInTheDocument();
    expect(adminTokenStorage.getAccess()).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows an error on bad credentials", async () => {
    mockAuth(401, 200);
    renderWithProviders(<ConsoleLoginPage />);
    await submit();

    expect(await screen.findByText(/identifiants invalides/i)).toBeInTheDocument();
    expect(adminTokenStorage.getAccess()).toBeNull();
  });
});
