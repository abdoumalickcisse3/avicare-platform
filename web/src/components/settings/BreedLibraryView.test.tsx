import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { BreedLibraryView } from "./BreedLibraryView";

const FARMS = [{ id: 1, name: "Ferme test", active: true, createdBy: 1, createdAt: "2026-01-01" }];

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
    farmId: 1,
    active: true,
  },
];

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function setupFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/breeds")) return respond(BREEDS);
      if (url.includes("/farms")) return respond(FARMS);
      return respond([]);
    }),
  );
}

describe("BreedLibraryView", () => {
  beforeEach(() => {
    setupFetch();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("liste les souches propres à la ferme, sans les souches de catalogue", async () => {
    renderWithProviders(<BreedLibraryView />);

    expect(await screen.findByText("Goliath")).toBeInTheDocument();
    expect(screen.queryByText("Cobb 500")).not.toBeInTheDocument();
    expect(await screen.findByText(/chair rustique \(croissance lente\)/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("2000 g / 90 j")).toBeInTheDocument());
  });
});
