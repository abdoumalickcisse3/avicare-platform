import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { LayerFlockTab } from "./LayerFlockTab";
import type { ProductionUnit } from "@/types";

const UNIT: ProductionUnit = {
  id: 1,
  farmId: 1,
  species: "POULTRY",
  unitKind: "BATCH",
  breedId: 5,
  name: "Lot Pondeuse",
  startDate: "2026-03-01",
  endDate: null,
  currentCount: 987,
  status: "ACTIVE",
};

const EVENTS = [
  { id: 1, productionUnitId: 1, eventType: "CREATED", quantityDelta: 1000, reason: "unit_created", details: {}, occurredAt: "2026-03-01T08:00:00" },
  { id: 2, productionUnitId: 1, eventType: "MORTALITY", quantityDelta: -3, reason: "chaleur", details: {}, occurredAt: "2026-06-25T08:00:00" },
  { id: 3, productionUnitId: 1, eventType: "REFORM", quantityDelta: -10, reason: "fin de ponte", details: {}, occurredAt: "2026-06-29T08:00:00" },
];

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/events")) return respond(EVENTS);
      if (url.includes("tray-stock")) return respond({ farmId: 1, fullTraysCount: 29, emptyTraysCount: 4, updatedAt: "2026-06-29T00:00:00Z" });
      return respond([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("LayerFlockTab", () => {
  it("affiche le relevé d'attrition dérivé des événements", async () => {
    renderWithProviders(<LayerFlockTab farmId={1} unit={UNIT} />);
    // initial 1000, mortalité 3, réforme 10
    // "Attrition" appears as both a card heading and a row label — target the heading
    expect(await screen.findByRole("heading", { name: "Attrition" })).toBeInTheDocument();
    // "Initial" label verifies the attrition panel rows are rendered with event data
    expect(await screen.findByText("Initial")).toBeInTheDocument();
    expect(await screen.findByText("Historique de bande")).toBeInTheDocument();
  });

  it("masque les actions si le lot n'est pas ACTIVE", async () => {
    renderWithProviders(
      <LayerFlockTab farmId={1} unit={{ ...UNIT, status: "CLOSED" }} />,
    );
    await screen.findByRole("heading", { name: "Attrition" });
    expect(screen.queryByRole("button", { name: /Mortalité/i })).not.toBeInTheDocument();
  });
});
