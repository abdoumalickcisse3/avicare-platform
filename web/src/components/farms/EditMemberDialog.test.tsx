import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { EditMemberDialog } from "./EditMemberDialog";
import type { Member } from "@/types";

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
});
