import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { BreedDialog } from "./BreedDialog";

const CREATED_BREED = {
  id: 10,
  species: "POULTRY",
  code: "goliath",
  name: "Goliath",
  type: "broiler",
  profile: "BROILER_RUSTIC",
  defaultTargetWeightG: 2000,
  defaultTargetAgeDays: 90,
  farmId: 1,
  active: true,
};

function respond(data: unknown, status = 201) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

let lastBody: Record<string, unknown> | null = null;
let lastMethod = "";
let lastUrl = "";

function setupFetch() {
  lastBody = null;
  lastMethod = "";
  lastUrl = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      lastUrl = url;
      lastMethod = input instanceof Request ? input.method : (init?.method ?? "GET");
      if (input instanceof Request) {
        try {
          lastBody = await input.clone().json();
        } catch {
          /* no body */
        }
      } else if (init?.body) {
        lastBody = JSON.parse(init.body as string);
      }
      if (url.includes("/breeds") && lastMethod === "POST") return respond(CREATED_BREED);
      return respond([]);
    }),
  );
}

describe("BreedDialog", () => {
  beforeEach(() => {
    setupFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("déclare la souche saisie avec le profil choisi", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BreedDialog open onClose={vi.fn()} farmId={1} />);

    await user.type(screen.getByLabelText(/nom de la souche/i), "Goliath");

    const profileSelect = screen.getByRole("combobox", { name: /profil/i });
    await user.click(profileSelect);
    await user.click(
      await screen.findByRole("option", { name: /chair rustique \(croissance lente\)/i }),
    );

    await user.click(screen.getByRole("button", { name: /déclarer/i }));

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastUrl).toContain("/api/v1/farms/1/breeds");
    expect(lastBody).toEqual({ name: "Goliath", profile: "BROILER_RUSTIC" });
  });

  it("n'envoie aucun code, seulement le nom", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BreedDialog open onClose={vi.fn()} farmId={1} />);

    await user.type(screen.getByLabelText(/nom de la souche/i), "Kuroiler");

    const profileSelect = screen.getByRole("combobox", { name: /profil/i });
    await user.click(profileSelect);
    await user.click(
      await screen.findByRole("option", { name: /chair rustique \(croissance lente\)/i }),
    );

    await user.click(screen.getByRole("button", { name: /déclarer/i }));

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastBody).not.toHaveProperty("code");
    expect(lastBody).not.toHaveProperty("species");
    expect(lastBody?.name).toBe("Kuroiler");
  });

  it("exige un nom et un profil", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BreedDialog open onClose={vi.fn()} farmId={1} />);

    await user.click(screen.getByRole("button", { name: /déclarer/i }));

    expect(await screen.findByText("Nom requis")).toBeInTheDocument();
    expect(screen.getByText("Profil requis")).toBeInTheDocument();
  });
});
