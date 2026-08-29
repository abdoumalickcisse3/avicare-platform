import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ChangePasswordForm } from "./ChangePasswordForm";

interface Call {
  url: string;
  method: string;
  body?: string;
}

function mockApi(status = 204, payload: unknown = { data: null }) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    // fetchBaseQuery hands fetch a Request, not (url, init).
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      calls.push({
        url: request ? request.url : String(input),
        method: request ? request.method : (init?.method ?? "GET"),
        body: request ? await request.clone().text() : (init?.body as string | undefined),
      });
      // A 204 must carry no body — the Response constructor throws otherwise.
      return new Response(status === 204 ? null : JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

async function fill(current: string, next: string, confirm: string) {
  await userEvent.type(screen.getByLabelText("Mot de passe actuel"), current);
  await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), next);
  await userEvent.type(screen.getByLabelText("Confirmer"), confirm);
  await userEvent.click(screen.getByRole("button", { name: /changer mon mot de passe/i }));
}

afterEach(() => vi.unstubAllGlobals());

describe("ChangePasswordForm", () => {
  it("sends both passwords and signals the caller", async () => {
    const calls = mockApi();
    const onChanged = vi.fn();
    renderWithProviders(<ChangePasswordForm onChanged={onChanged} />);

    await fill("AncienPass1", "NouveauPass1", "NouveauPass1");

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.url).toContain("/api/v1/account/password");
    expect(JSON.parse(post.body as string)).toEqual({
      currentPassword: "AncienPass1",
      newPassword: "NouveauPass1",
    });
  });

  it("refuses a mismatched confirmation without calling the server", async () => {
    const calls = mockApi();
    renderWithProviders(<ChangePasswordForm onChanged={vi.fn()} />);

    await fill("AncienPass1", "NouveauPass1", "AutreChose1");

    expect(await screen.findByText(/ne correspondent pas/)).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("shows the server's refusal when the current password is wrong", async () => {
    mockApi(422, {
      type: "https://avicare.com/errors/password-current-invalid",
      title: "Password Current Invalid",
      status: 422,
      detail: "Le mot de passe actuel est incorrect.",
      code: "PASSWORD_CURRENT_INVALID",
    });
    const onChanged = vi.fn();
    renderWithProviders(<ChangePasswordForm onChanged={onChanged} />);

    await fill("MauvaisPass1", "NouveauPass1", "NouveauPass1");

    expect(await screen.findByText(/mot de passe actuel est incorrect/)).toBeInTheDocument();
    // The surface must not tear down the session on a failed attempt.
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("warns that every session will be closed", async () => {
    mockApi();
    renderWithProviders(<ChangePasswordForm onChanged={vi.fn()} />);

    // The consequence is surprising enough that discovering it after the fact is a bad experience.
    expect(screen.getByText(/sessions seront fermées/)).toBeInTheDocument();
  });
});
