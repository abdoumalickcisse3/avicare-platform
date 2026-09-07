import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";

/**
 * Les suppressions du module sanitaire sont des gestes de **supervision** : le backend les
 * réserve plus étroitement que la saisie, et chaque écran doit suivre SA garde à lui.
 *
 *   observation  → WRITE_BASIC_MANAGER    (OWNER / MANAGER)
 *   vaccination  → WRITE_BASIC_MANAGER    (OWNER / MANAGER)
 *   traitement   → ADMIN_ADVANCED_OWNER   (OWNER seul)
 *   visite véto  → WRITE_ADVANCED_MANAGER (OWNER / MANAGER)
 *
 * Les deux écrans testés ici ne suivaient pas la leur : la corbeille des observations était
 * offerte sur `health:write` (un ouvrier la voyait), celle des traitements n'était gardée par
 * rien du tout. Un bouton qui répond 403 apprend à se méfier de l'application.
 */

let role = "OWNER";
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => role,
}));
// `health:write` accordé : c'est bien le rôle, et non la permission, qui doit décider ici.
vi.mock("@/hooks/useFarmPermissions", () => ({
  useFarmPermissions: () => ({ can: () => true }),
}));

import { ObservationsList } from "./ObservationsList";
import { ActiveTreatmentsList } from "./ActiveTreatmentsList";

const OBSERVATION = {
  id: 2,
  unitId: 12,
  title: "Toux",
  observationDate: "2026-08-02",
  severity: "CRITICAL",
  description: null,
  suspectedDisease: null,
  affectedCount: null,
  createdBy: null,
  createdAt: "2026-08-02T08:00:00",
};

const TREATMENT = {
  id: 5,
  unitId: 12,
  treatmentKey: "oxytetracycline",
  startDate: "2026-08-01",
  endDate: "2026-08-05",
  doseAmount: 2,
  doseUnit: "ml",
  route: "ORAL",
  withdrawalEndDateMeat: null,
  withdrawalEndDateEggs: null,
  reason: null,
  createdBy: null,
  createdAt: "2026-08-01T08:00:00",
};

function mockFetch(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  role = "OWNER";
});

describe("Suppression d'une observation (OWNER / MANAGER)", () => {
  const setup = () =>
    renderWithProviders(
      <ObservationsList farmId={7} unitId={12} unitName="Lot #12" currentUserId={2} />,
    );

  it("est refusée à un ouvrier, malgré health:write", async () => {
    role = "FARMER";
    mockFetch([OBSERVATION]);
    setup();

    expect(await screen.findByText("Toux")).toBeInTheDocument();
    expect(screen.queryByLabelText("Supprimer")).toBeNull();
  });

  it("est offerte au gérant", async () => {
    role = "MANAGER";
    mockFetch([OBSERVATION]);
    setup();

    expect(await screen.findByLabelText("Supprimer")).toBeInTheDocument();
  });
});

describe("Suppression d'un traitement (OWNER seul)", () => {
  const setup = () =>
    renderWithProviders(
      <ActiveTreatmentsList farmId={7} unitId={12} unitName="Lot #12" currentCount={400} currentUserId={2} />,
    );

  it("est refusée au gérant : un traitement porte des délais d'attente", async () => {
    role = "MANAGER";
    mockFetch([TREATMENT]);
    setup();

    expect(await screen.findByText(/Oxytetracycline/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Supprimer")).toBeNull();
  });

  it("est offerte au propriétaire", async () => {
    mockFetch([TREATMENT]);
    setup();

    expect(await screen.findByLabelText("Supprimer")).toBeInTheDocument();
  });
});
