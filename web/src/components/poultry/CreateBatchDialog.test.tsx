import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { CreateBatchDialog } from "./CreateBatchDialog";

const today = new Date().toISOString().slice(0, 10);

describe("CreateBatchDialog", () => {
  it("renders the create form with smart default targets and today's date", () => {
    renderWithProviders(<CreateBatchDialog open onClose={vi.fn()} farmId={1} />);
    expect(screen.getByText(/créer un nouveau lot/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date d'arrivée/i)).toHaveValue(today);
    expect(screen.getByLabelText(/poids cible/i)).toHaveValue(2000);
    expect(screen.getByLabelText(/âge cible/i)).toHaveValue(42);
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
  { id: 1, species: "POULTRY", code: "cobb_500", name: "Cobb 500", type: "broiler", farmId: null, active: true },
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
