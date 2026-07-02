import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { ThemeProvider } from "@mui/material/styles";
import { renderWithProviders } from "@/test/render";
import { makeStore } from "@/store/store";
import { avicareTheme } from "@/theme";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { AddMemberDialog } from "./AddMemberDialog";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

let lastBody: Record<string, unknown> | null = null;

beforeEach(() => {
  lastBody = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (input instanceof Request) {
        try {
          lastBody = await input.clone().json();
        } catch {
          /* no body */
        }
      } else if (init?.body) {
        lastBody = JSON.parse(init.body as string);
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
      if (url.includes("/users")) {
        return respond({
          member: {
            id: 1,
            userId: 5,
            farmId: 1,
            fullName: "Awa Diop",
            email: "awa@f.io",
            phone: null,
            role: "FARMER",
            permissions: ["poultry:read"],
            active: true,
          },
          temporaryPassword: "Temp123abcd",
        });
      }
      return respond([]);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("AddMemberDialog", () => {
  it("renders the core fields", async () => {
    renderWithProviders(<AddMemberDialog open onClose={vi.fn()} farmId={1} />);
    expect(screen.getByLabelText(/nom complet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/rôle/i)).toBeInTheDocument();
  });

  it("reveals the permission grid when 'Personnaliser' is toggled on", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddMemberDialog open onClose={vi.fn()} farmId={1} />);

    await waitFor(() =>
      expect(screen.queryByText("Élevage volaille")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("switch", { name: /personnaliser les accès/i }));

    expect(await screen.findByText("Élevage volaille")).toBeInTheDocument();
  });

  it("submits without customization: no permissions key in the request body", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddMemberDialog open onClose={vi.fn()} farmId={1} />);

    await user.type(screen.getByLabelText(/nom complet/i), "Awa Diop");
    await user.type(screen.getByLabelText(/adresse e-mail/i), "awa@f.io");

    await user.click(screen.getByRole("button", { name: /créer le compte/i }));

    await waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody).toMatchObject({
      fullName: "Awa Diop",
      email: "awa@f.io",
      role: "FARMER",
    });
    expect(lastBody).not.toHaveProperty("permissions");
  });

  it("shows the temporary password after a successful submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddMemberDialog open onClose={vi.fn()} farmId={1} />);

    await user.type(screen.getByLabelText(/nom complet/i), "Awa Diop");
    await user.type(screen.getByLabelText(/adresse e-mail/i), "awa@f.io");

    await user.click(screen.getByRole("button", { name: /créer le compte/i }));

    expect(await screen.findByText("Temp123abcd")).toBeInTheDocument();
  });

  it("seeds the permission grid from the role's defaults when customization is toggled on", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddMemberDialog open onClose={vi.fn()} farmId={1} />);

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /personnaliser les accès/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("switch", { name: /personnaliser les accès/i }));
    await screen.findByText("Élevage volaille");

    expect(screen.getByRole("checkbox", { name: "poultry:read" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "poultry:write" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "poultry:delete" })).not.toBeChecked();
  });

  it("resets edited permissions to the role's defaults when the dialog is reopened", async () => {
    const user = userEvent.setup();
    // Use a wrapper-based render so `rerender` keeps the Redux/theme/toast
    // context alive across the close/reopen cycle (renderWithProviders'
    // rerender would tear the whole provider tree down with it).
    const store = makeStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>
        <ThemeProvider theme={avicareTheme}>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </Provider>
    );
    const { rerender } = render(<AddMemberDialog open onClose={vi.fn()} farmId={1} />, {
      wrapper,
    });

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: /personnaliser les accès/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("switch", { name: /personnaliser les accès/i }));
    await screen.findByText("Élevage volaille");

    // Edit away from the FARMER defaults.
    await user.click(screen.getByRole("checkbox", { name: "poultry:delete" }));
    expect(screen.getByRole("checkbox", { name: "poultry:delete" })).toBeChecked();

    // Close then reopen the dialog.
    rerender(<AddMemberDialog open={false} onClose={vi.fn()} farmId={1} />);
    rerender(<AddMemberDialog open onClose={vi.fn()} farmId={1} />);

    await user.click(screen.getByRole("switch", { name: /personnaliser les accès/i }));
    await screen.findByText("Élevage volaille");

    expect(screen.getByRole("checkbox", { name: "poultry:read" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "poultry:write" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "poultry:delete" })).not.toBeChecked();
  });
});
