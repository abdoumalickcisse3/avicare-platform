import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { SurveyAnswers } from "./SurveyAnswers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/enquete",
}));

const ANSWER = {
  id: 42,
  receivedAt: "2026-11-15T09:12:00",
  country: "CI",
  region: "Abidjan",
  commune: "Yopougon",
  referrer: "Amadou",
  flockType: "BROILER",
  currentBirds: 480,
  batchesLast12Months: 4,
  startedYear: 2021,
  workers: 2,
  lastBatchMonth: "2026-09-01",
  birdsPlaced: 500,
  chickPrice: 650,
  birdsDied: 37,
  feedBags: 42,
  lastBagPrice: 19500,
  lastBagBrand: "Sénégal Aliment",
  lastBagMonth: "2026-10-01",
  feedSupplier: "Provende du Sahel",
  paymentTerms: "CREDIT",
  creditDays: 30,
  creditCostsMore: true,
  rawMaterialPrices: "maïs à 280 F le kilo",
  mainBuyer: "RESELLER",
  lastSalePrice: 3200,
  lastSaleUnit: "LIVE_BIRD",
  lastSaleMonth: "2026-10-01",
  paymentDelay: "ONE_TO_FOUR_WEEKS",
  firstCall: "FEED_TECHNICIAN",
  lastIncidentCost: 125000,
  recordKeeping: "NOTEBOOK",
  willingnessToPay: "FROM_5K_TO_15K",
  hasQuit: true,
  quitReason: "trop de saisie",
  phone: "+2250700000001",
  acceptsInterview: true,
};

const INTAKE = {
  total: 3,
  withPhone: 2,
  acceptingInterview: 1,
  lastAnswerOn: "2026-11-15",
  publicationFloor: 5,
  countries: [{ country: "CI", answers: 2 }, { country: "SN", answers: 1 }],
  areas: [
    { country: "CI", region: "Abidjan", answers: 2, missingBeforePublication: 3 },
    { country: "SN", region: "Thiès", answers: 6, missingBeforePublication: 0 },
  ],
  referrers: [{ referrer: "Amadou", answers: 2 }],
};

function mockApi(items: unknown[] = [ANSWER], intake: unknown = INTAKE) {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      urls.push(url);
      const body = url.includes("/survey/intake")
        ? { data: intake }
        : { items, page: 0, size: 200, totalElements: items.length, totalPages: 1 };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  adminTokenStorage.clear();
});

describe("SurveyAnswers", () => {
  it("shows how many answers each area still needs before its figures are published", async () => {
    mockApi();
    renderWithProviders(<SurveyAnswers />);

    // Scoped to the progress table: "3" is also a count in a tile above, and "Abidjan" appears
    // again in the answers table below.
    const progress = within(
      await screen.findByRole("table", { name: "Avancement vers la publication" }),
    );
    const abidjan = within(progress.getByRole("row", { name: /Abidjan/ }));
    expect(abidjan.getByText("2")).toBeInTheDocument();
    expect(abidjan.getByText("3")).toBeInTheDocument();

    // Thiès is over the floor and says so instead of showing a 0 to chase.
    expect(
      within(progress.getByRole("row", { name: /Thiès/ })).getByText("publiée"),
    ).toBeInTheDocument();

    expect(screen.getByText(/Il faut 5 réponses/)).toBeInTheDocument();
  });

  it("names the relays as the respondents wrote them", async () => {
    mockApi();
    renderWithProviders(<SurveyAnswers />);

    // The card's title is static, so it renders before the summary arrives: wait for the data.
    expect(await screen.findAllByText("Amadou")).not.toHaveLength(0);
    expect(screen.getByText("Qui relaie le lien")).toBeInTheDocument();
  });

  it("speaks the questionnaire's words, not the server's codes", async () => {
    mockApi();
    renderWithProviders(<SurveyAnswers />);

    expect(await screen.findByText("Poulets de chair")).toBeInTheDocument();
    expect(screen.getByText("Sur un cahier")).toBeInTheDocument();
    expect(screen.getByText("5 000 à 15 000 F")).toBeInTheDocument();
    expect(screen.queryByText("BROILER")).not.toBeInTheDocument();
    expect(screen.queryByText("NOTEBOOK")).not.toBeInTheDocument();
  });

  it("opens one answer and reads the whole questionnaire back", async () => {
    mockApi();
    renderWithProviders(<SurveyAnswers />);

    await userEvent.click(await screen.findByText("Poulets de chair"));

    expect(await screen.findByText(/Réponse n° 42/)).toBeInTheDocument();
    expect(screen.getByText("Provende du Sahel")).toBeInTheDocument();
    expect(screen.getByText("maïs à 280 F le kilo")).toBeInTheDocument();
    expect(screen.getByText("Bana-bana / revendeur")).toBeInTheDocument();
    expect(screen.getByText("trop de saisie")).toBeInTheDocument();
    // "Rien du tout" and "Rien" share the NOTHING code: the right question must be answered.
    expect(screen.getByText("Le technicien du provendier")).toBeInTheDocument();
  });

  it("filters by country, by region and down to the people to call back", async () => {
    const urls = mockApi();
    renderWithProviders(<SurveyAnswers />);
    await screen.findByText("Poulets de chair");

    await userEvent.type(screen.getByLabelText("Région"), "abid");
    await waitFor(() => expect(urls.some((u) => u.includes("region=abid"))).toBe(true));

    await userEvent.click(screen.getByLabelText("À rappeler"));
    await waitFor(() => expect(urls.some((u) => u.includes("interviewOnly=true"))).toBe(true));
  });

  it("says plainly that nothing has come in yet, rather than showing an empty table", async () => {
    mockApi([], { ...INTAKE, total: 0, areas: [], referrers: [], lastAnswerOn: null });
    renderWithProviders(<SurveyAnswers />);

    expect(await screen.findByText(/Aucune réponse pour l'instant/)).toBeInTheDocument();
    expect(screen.getByText(/Aucune région pour l'instant/)).toBeInTheDocument();
  });

  it("offers no export while there is nothing to export", async () => {
    mockApi([]);
    renderWithProviders(<SurveyAnswers />);

    expect(await screen.findByRole("button", { name: /Exporter/ })).toBeDisabled();
  });
});
