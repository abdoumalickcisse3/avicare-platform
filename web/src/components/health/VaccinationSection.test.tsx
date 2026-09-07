import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";

vi.mock("@/hooks/useFarmPermissions", () => ({
  useFarmPermissions: () => ({ can: () => true }),
}));

let role = "OWNER";
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => role,
}));

import { VaccinationSection } from "./VaccinationSection";

const VACCINATIONS = [
  {
    id: 1,
    unitId: 9,
    vaccineKey: "NEWCASTLE_HB1",
    administeredDate: "2026-08-14",
    route: "EYE_DROP",
    dosePerSubject: null,
    doseUnit: null,
    subjectsCount: 480,
    vaccineBatchNumber: null,
    vaccineExpiryDate: null,
    administeredByUserId: null,
    notes: null,
    createdBy: null,
    createdAt: "2026-08-14T08:00:00",
  },
];

/** No programme assigned: the assignment read answers 404, everything else answers empty. */
function mockFetch(opts?: { vaccinations?: unknown[]; assignment?: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/vaccinations")) {
        return new Response(JSON.stringify({ data: opts?.vaccinations ?? VACCINATIONS }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // `getProgramAssignment` reads `…/lots/{unitId}/program` — null means "no programme".
      const data = /\/lots\/\d+\/program$/.test(url) ? (opts?.assignment ?? null) : [];
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

function setup() {
  renderWithProviders(
    <VaccinationSection
      farmId={1}
      unitId={9}
      unitName="Lot #9"
      breedId={3}
      startDate="2026-08-01"
      currentAgeDays={37}
      currentCount={480}
      currentUserId={2}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  role = "OWNER";
});

describe("VaccinationSection", () => {
  it("montre les vaccinations faites sur un lot sans programme assigné", async () => {
    // La section proposait « Saisir une vaccination ponctuelle » puis n'en montrait aucune
    // trace : on pouvait vacciner sans en avoir le moindre accusé de réception.
    mockFetch();
    setup();

    expect(await screen.findByText("Aucun programme vaccinal assigné à ce lot.")).toBeInTheDocument();
    expect(await screen.findByText("Vaccinations enregistrées")).toBeInTheDocument();
    expect(screen.getByText("NEWCASTLE HB1")).toBeInTheDocument();
    expect(screen.getByText(/480 sujets/)).toBeInTheDocument();
  });

  it("réserve le retrait d'une dose au propriétaire ou au gérant", async () => {
    // Enregistrer demande `health:write` ; retirer est un geste de supervision, réservé
    // OWNER/MANAGER côté backend (`WRITE_BASIC_MANAGER`).
    role = "FARMER";
    mockFetch();
    setup();

    expect(await screen.findByText("Vaccinations enregistrées")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Supprimer la vaccination/)).toBeNull();
  });

  it("l'offre au propriétaire, en disant ce que la dose redevient", async () => {
    mockFetch();
    setup();

    await userEvent.click(await screen.findByLabelText("Supprimer la vaccination NEWCASTLE HB1"));
    expect(screen.getByText(/celle-ci redeviendra à faire/)).toBeInTheDocument();
  });

  it("ne montre pas de section vide quand rien n'a été administré", async () => {
    mockFetch({ vaccinations: [] });
    setup();

    expect(await screen.findByText("Aucun programme vaccinal assigné à ce lot.")).toBeInTheDocument();
    expect(screen.queryByText("Vaccinations enregistrées")).toBeNull();
  });
});
