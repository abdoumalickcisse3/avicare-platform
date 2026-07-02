import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { EditMemberDialog } from "./EditMemberDialog";
import type { Member } from "@/types";
import { Provider } from "react-redux";
import { ThemeProvider } from "@mui/material/styles";
import { makeStore } from "@/store/store";
import { avicareTheme } from "@/theme";
import { ToastProvider } from "@/components/feedback/ToastProvider";

const MEMBER: Member = {
  id: 3,
  userId: 7,
  farmId: 1,
  fullName: "Awa Diop",
  email: "awa@f.io",
  phone: "+221770000000",
  role: "FARMER",
  permissions: ["poultry:read", "poultry:write"],
  active: true,
};

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

let lastBody: Record<string, unknown> | null = null;
let lastUrl = "";
let lastMethod = "";

beforeEach(() => {
  lastBody = null;
  lastUrl = "";
  lastMethod = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      lastUrl = url;
      if (input instanceof Request) {
        lastMethod = input.method;
        try {
          lastBody = await input.clone().json();
        } catch {
          /* no body */
        }
      } else if (init) {
        lastMethod = init.method ?? "GET";
        if (init.body) lastBody = JSON.parse(init.body as string);
      }
      if (url.includes("/permissions/catalog")) {
        return respond({
          resources: [
            { resource: "poultry", label: "Élevage volaille", verbs: ["read", "write", "delete"] },
            { resource: "finance", label: "Finance", verbs: ["read", "write"] },
          ],
          roleDefaults: {
            FARMER: ["poultry:read", "poultry:write"],
            MANAGER: ["poultry:*", "finance:read"],
            VETERINARIAN: ["health:read"],
            BUYER: ["commercial:read"],
          },
        });
      }
      if (url.includes("/reset-password")) {
        return respond({ temporaryPassword: "New456xyz" });
      }
      if (url.includes("/users/")) {
        return respond({ ...MEMBER, role: "MANAGER" });
      }
      return respond([]);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("EditMemberDialog", () => {
  it("header shows the member's full name and email", async () => {
    renderWithProviders(
      <EditMemberDialog open onClose={vi.fn()} farmId={1} member={MEMBER} />,
    );

    expect(screen.getByText("Awa Diop")).toBeInTheDocument();
    expect(screen.getByText(/awa@f\.io/)).toBeInTheDocument();
  });

  it("submitting 'Enregistrer les modifications' issues a PUT with role/permissions/active", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <EditMemberDialog open onClose={vi.fn()} farmId={1} member={MEMBER} />,
    );

    await user.click(
      screen.getByRole("button", { name: /enregistrer les modifications/i }),
    );

    await waitFor(() =>
      expect(lastBody).toMatchObject({ role: expect.any(String), active: true }),
    );
    expect(lastMethod).toBe("PUT");
    expect(lastUrl).toContain(`/users/${MEMBER.userId}`);
  });

  it("clicking 'Réinitialiser le mot de passe' reveals the returned temporary password", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <EditMemberDialog open onClose={vi.fn()} farmId={1} member={MEMBER} />,
    );

    await user.click(
      screen.getByRole("button", { name: /réinitialiser le mot de passe/i }),
    );

    expect(await screen.findByText("New456xyz")).toBeInTheDocument();
  });

  it("saving with permissions unchanged sends the seeded permissions array in the PUT body", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <EditMemberDialog open onClose={vi.fn()} farmId={1} member={MEMBER} />,
    );

    await user.click(
      screen.getByRole("button", { name: /enregistrer les modifications/i }),
    );

    await waitFor(() => expect(lastBody).not.toBeNull());
    expect(Array.isArray(lastBody?.permissions)).toBe(true);
    expect(lastBody?.permissions).toEqual(MEMBER.permissions);
  });

  it("reopening the same member discards unsaved edits made before closing without saving", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    const wrap = (open: boolean) => (
      <Provider store={store}>
        <ThemeProvider theme={avicareTheme}>
          <ToastProvider>
            <EditMemberDialog open={open} onClose={vi.fn()} farmId={1} member={MEMBER} />
          </ToastProvider>
        </ThemeProvider>
      </Provider>
    );

    const { rerender } = render(wrap(true));

    // Open: toggle "Compte actif" off (unsaved edit).
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /compte actif/i })).toBeChecked(),
    );
    await user.click(screen.getByRole("switch", { name: /compte actif/i }));
    expect(screen.getByRole("switch", { name: /compte actif/i })).not.toBeChecked();

    // Close without saving.
    rerender(wrap(false));

    // Reopen the SAME member.
    rerender(wrap(true));

    // The switch should reflect the seeded member.active === true again, not
    // the abandoned "off" edit.
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /compte actif/i })).toBeChecked(),
    );

    await user.click(
      screen.getByRole("button", { name: /enregistrer les modifications/i }),
    );

    await waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody?.active).toBe(true);
  });
});
