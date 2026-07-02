import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { FarmTeamTab } from "./FarmTeamTab";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const members = [
  {
    id: 1,
    userId: 5,
    farmId: 1,
    fullName: "Awa Diop",
    email: "awa@f.io",
    phone: null,
    role: "OWNER",
    permissions: ["*"],
    active: true,
  },
  {
    id: 2,
    userId: 9,
    farmId: 1,
    fullName: "Moussa Ba",
    email: "moussa@f.io",
    phone: null,
    role: "FARMER",
    permissions: [],
    active: false,
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/permissions/catalog")) {
        return respond({
          resources: [
            { resource: "poultry", label: "Élevage volaille", verbs: ["read", "write", "delete"] },
          ],
          roleDefaults: {
            FARMER: ["poultry:read"],
            MANAGER: ["poultry:*"],
            VETERINARIAN: ["health:read"],
            BUYER: ["commercial:read"],
          },
        });
      }
      if (url.includes("/users")) {
        return respond(members);
      }
      return respond([]);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("FarmTeamTab", () => {
  it("renders members by full name and email with role/status", async () => {
    renderWithProviders(<FarmTeamTab farmId={1} />);
    expect(await screen.findByText("Awa Diop")).toBeInTheDocument();
    expect(screen.getByText("awa@f.io")).toBeInTheDocument();
    expect(screen.getByText("Moussa Ba")).toBeInTheDocument();
    expect(screen.getByText("moussa@f.io")).toBeInTheDocument();
    expect(screen.getByText("Propriétaire")).toBeInTheDocument();
    expect(screen.getByText("Éleveur")).toBeInTheDocument();
    expect(screen.getByText("Inactif")).toBeInTheDocument();
  });

  it("opens AddMemberDialog when 'Ajouter un membre' is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FarmTeamTab farmId={1} />);
    await screen.findByText("Awa Diop");

    await user.click(screen.getByRole("button", { name: /ajouter un membre/i }));

    expect(await screen.findByLabelText(/nom complet/i)).toBeInTheDocument();
  });

  it("opens EditMemberDialog with the selected member when 'Modifier' is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<FarmTeamTab farmId={1} />);
    await screen.findByText("Awa Diop");

    await user.click(screen.getByRole("button", { name: /modifier moussa ba/i }));

    await waitFor(() =>
      expect(screen.getByText("Modifier le membre")).toBeInTheDocument(),
    );
    expect(screen.getAllByText("Moussa Ba").length).toBeGreaterThan(0);
  });
});
