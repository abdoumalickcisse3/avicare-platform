import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { CreateBatchDialog } from "./CreateBatchDialog";

const today = new Date().toISOString().slice(0, 10);

describe("CreateBatchDialog", () => {
  it("n'invente aucune cible avant qu'une souche soit choisie", () => {
    renderWithProviders(<CreateBatchDialog open onClose={vi.fn()} farmId={1} />);
    expect(screen.getByText(/créer un nouveau lot/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date d'arrivée/i)).toHaveValue(today);
    expect(screen.getByLabelText(/poids cible/i)).toHaveValue(null);
    expect(screen.getByLabelText(/âge cible/i)).toHaveValue(null);
  });

  it("requires a breed and an initial count", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateBatchDialog open onClose={vi.fn()} farmId={1} />);

    await user.click(screen.getByRole("button", { name: /créer le lot/i }));

    expect(await screen.findByText("Souche requise")).toBeInTheDocument();
    expect(screen.getByText("Effectif requis")).toBeInTheDocument();
  });
});

// ── coût d'achat des poussins ────────────────────────────────────────────────

const BREEDS = [
  {
    id: 1,
    species: "POULTRY",
    code: "cobb_500",
    name: "Cobb 500",
    type: "broiler",
    profile: "BROILER_FAST",
    defaultTargetWeightG: 2100,
    defaultTargetAgeDays: 42,
    farmId: null,
    active: true,
  },
  {
    id: 2,
    species: "POULTRY",
    code: "goliath",
    name: "Goliath",
    type: "broiler",
    profile: "BROILER_RUSTIC",
    defaultTargetWeightG: 2000,
    defaultTargetAgeDays: 90,
    farmId: null,
    active: true,
  },
  {
    id: 3,
    species: "POULTRY",
    code: "locale_amelioree",
    name: "Locale améliorée (ponte)",
    type: "layer",
    profile: "LAYER_RUSTIC",
    defaultTargetWeightG: null,
    defaultTargetAgeDays: null,
    farmId: null,
    active: true,
  },
];

const CREATED_BATCH = {
  id: 99,
  farmId: 1,
  breedId: 1,
  name: undefined,
  startDate: today,
  status: "ACTIVE",
  currentCount: 100,
  initialCount: 100,
  targetWeightG: 2000,
  targetAgeDays: 42,
  chickPurchaseCostXof: null,
  expectedCurve: [],
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
let lastMethod = "";

function setupFetch() {
  lastBody = null;
  lastMethod = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // RTK Query passes a Request object; extract the URL string.
      const url = input instanceof Request ? input.url : String(input);
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
      if (url.includes("/breeds")) return respond(BREEDS);
      if (url.includes("poultry-batches") && lastMethod === "POST") return respond(CREATED_BATCH);
      return respond([]);
    }),
  );
}

async function fillRequiredFieldsAndMaybePrice(price?: string) {
  const user = userEvent.setup();
  renderWithProviders(<CreateBatchDialog open onClose={vi.fn()} farmId={1} />);

  const breedSelect = await screen.findByRole("combobox", { name: /souche de volaille/i });
  await user.click(breedSelect);
  await user.click(await screen.findByRole("option", { name: "Cobb 500" }));

  await user.type(screen.getByLabelText(/effectif initial/i), "100");

  if (price !== undefined) {
    await user.type(screen.getByLabelText(/prix par poussin/i), price);
  }

  await user.click(screen.getByRole("button", { name: /créer le lot/i }));
}

describe("CreateBatchDialog — coût d'achat des poussins", () => {
  beforeEach(() => {
    setupFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envoie chickUnitPriceXof quand un prix est saisi", async () => {
    await fillRequiredFieldsAndMaybePrice("300");

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastBody).toMatchObject({ chickUnitPriceXof: 300 });
  });

  it("n'envoie pas chickUnitPriceXof quand le champ est laissé vide", async () => {
    await fillRequiredFieldsAndMaybePrice();

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastBody).not.toHaveProperty("chickUnitPriceXof");
  });
});

// ── cibles pré-remplies depuis le profil de la souche ───────────────────────

describe("CreateBatchDialog — cibles depuis le profil de la souche", () => {
  beforeEach(() => {
    setupFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pré-remplit les cibles depuis le profil de la souche choisie", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateBatchDialog open onClose={vi.fn()} farmId={1} />);

    const breedSelect = await screen.findByRole("combobox", { name: /souche de volaille/i });
    await user.click(breedSelect);
    await user.click(await screen.findByRole("option", { name: "Goliath" }));

    expect(screen.getByLabelText(/poids cible/i)).toHaveValue(2000);
    expect(screen.getByLabelText(/âge cible/i)).toHaveValue(90);
  });

  it("laisse les cibles vides quand la souche choisie n'en a aucune", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateBatchDialog open onClose={vi.fn()} farmId={1} />);

    const breedSelect = await screen.findByRole("combobox", { name: /souche de volaille/i });
    await user.click(breedSelect);
    await user.click(await screen.findByRole("option", { name: "Cobb 500" }));
    expect(screen.getByLabelText(/poids cible/i)).toHaveValue(2100);

    await user.click(breedSelect);
    await user.click(await screen.findByRole("option", { name: "Locale améliorée (ponte)" }));

    expect(screen.getByLabelText(/poids cible/i)).toHaveValue(null);
    expect(screen.getByLabelText(/âge cible/i)).toHaveValue(null);
  });
});
