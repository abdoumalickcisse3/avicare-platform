import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { UserSearch } from "./UserSearch";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/utilisateurs",
}));

const USER = {
  userId: 7,
  email: "modou@test.io",
  fullName: "Modou Diop",
  phone: "770000001",
  role: "USER",
  active: true,
  lastLoginAt: null,
};

function mockApi(users: unknown[], temporaryPassword = "TEMP1234") {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push(url);
      // /admin/me joined the component with the anonymise action; without it `me.permissions`
      // is undefined and every render in this file throws.
      const body = url.includes("reset-password")
        ? { data: { userId: 7, temporaryPassword } }
        : url.includes("/admin/me")
          ? { data: { userId: 1, email: "me@jawdi.app", permissions: ["*"], superAdmin: true } }
          : { data: users };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  adminTokenStorage.clear();
});

describe("UserSearch", () => {
  it("does not query anything before an explicit search", async () => {
    const calls = mockApi([USER]);
    renderWithProviders(<UserSearch />);

    // The query hits every account on the platform: it must be a deliberate act.
    expect(
      screen.getByText(/Saisissez un e-mail, un nom ou un téléphone/),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("finds an account and shows its status", async () => {
    mockApi([USER]);
    renderWithProviders(<UserSearch />);

    await userEvent.type(screen.getByPlaceholderText(/E-mail, nom ou téléphone/), "modou");
    await userEvent.click(screen.getByRole("button", { name: /rechercher/i }));

    expect(await screen.findByText("Modou Diop")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();
  });

  it("shows the temporary password in a dialog, not a toast", async () => {
    mockApi([USER]);
    renderWithProviders(<UserSearch />);

    await userEvent.type(screen.getByPlaceholderText(/E-mail, nom ou téléphone/), "modou");
    await userEvent.click(screen.getByRole("button", { name: /rechercher/i }));
    await userEvent.click(await screen.findByRole("button", { name: /réinitialiser/i }));

    // Shown once: it has to survive on screen until it is copied.
    expect(await screen.findByText("TEMP1234")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copier/i })).toBeInTheDocument();
  });

  it("reports when nothing matches", async () => {
    mockApi([]);
    renderWithProviders(<UserSearch />);

    await userEvent.type(screen.getByPlaceholderText(/E-mail, nom ou téléphone/), "zzz");
    await userEvent.click(screen.getByRole("button", { name: /rechercher/i }));

    expect(await screen.findByText("Aucun compte ne correspond.")).toBeInTheDocument();
  });

  it("does not anonymise on the first click: the address has to be typed back", async () => {
    const calls = mockApi([USER]);
    renderWithProviders(<UserSearch />);

    await userEvent.type(screen.getByPlaceholderText(/E-mail, nom ou téléphone/), "modou");
    await userEvent.click(screen.getByRole("button", { name: /rechercher/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^anonymiser$/i }));

    // The button used to set state and open nothing at all — the erasure never left the browser.
    expect(await screen.findByText(/Irréversible/)).toBeInTheDocument();

    const confirm = screen.getAllByRole("button", { name: /^anonymiser$/i }).at(-1)!;
    expect(confirm).toBeDisabled();
    expect(calls.some((u) => u.includes("anonymize"))).toBe(false);
  });

  it("sends the erasure once the address matches", async () => {
    const calls = mockApi([USER]);
    renderWithProviders(<UserSearch />);

    await userEvent.type(screen.getByPlaceholderText(/E-mail, nom ou téléphone/), "modou");
    await userEvent.click(screen.getByRole("button", { name: /rechercher/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^anonymiser$/i }));

    await userEvent.type(await screen.findByLabelText("Confirmer l'adresse"), USER.email);
    await userEvent.click(screen.getAllByRole("button", { name: /^anonymiser$/i }).at(-1)!);

    await vi.waitFor(() =>
      expect(calls.some((u) => u.includes(`/admin/compliance/users/${USER.userId}/anonymize`))).toBe(
        true,
      ),
    );
  });

  it("cuts the sessions when deactivating, so the deactivation actually bites", async () => {
    const calls = mockApi([USER]);
    renderWithProviders(<UserSearch />);

    await userEvent.type(screen.getByPlaceholderText(/E-mail, nom ou téléphone/), "modou");
    await userEvent.click(screen.getByRole("button", { name: /rechercher/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^désactiver$/i }));

    // Deactivating alone leaves the access token already in the browser working until it expires:
    // a dismissed account stays usable in the meantime.
    await vi.waitFor(() => {
      expect(calls.some((u) => u.includes(`/admin/users/${USER.userId}/deactivate`))).toBe(true);
      expect(calls.some((u) => u.includes(`/admin/users/${USER.userId}/revoke-sessions`))).toBe(
        true,
      );
    });
  });

  it("can cut the sessions of an account that stays active", async () => {
    const calls = mockApi([USER]);
    renderWithProviders(<UserSearch />);

    await userEvent.type(screen.getByPlaceholderText(/E-mail, nom ou téléphone/), "modou");
    await userEvent.click(screen.getByRole("button", { name: /rechercher/i }));
    await userEvent.click(await screen.findByRole("button", { name: /couper les sessions/i }));

    // The answer to a suspected compromise: end the sessions without dismissing the account.
    await vi.waitFor(() =>
      expect(calls.some((u) => u.includes(`/admin/users/${USER.userId}/revoke-sessions`))).toBe(
        true,
      ),
    );
    expect(calls.some((u) => u.includes("/deactivate"))).toBe(false);
    expect(
      await screen.findByText(/sessions de modou@test.io ont été coupées/i),
    ).toBeInTheDocument();
  });
});
