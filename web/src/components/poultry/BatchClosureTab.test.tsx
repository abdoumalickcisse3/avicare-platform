import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { BatchClosureTab } from "./BatchClosureTab";
import type { UnitClosure } from "@/types";

const closure: UnitClosure = {
  productionUnitId: 42,
  closedAt: "2026-09-02T10:00:00",
  startDate: "2026-07-19",
  endDate: "2026-09-02",
  durationDays: 45,
  initialCount: 1000,
  remainingCount: 180,
  deaths: 20,
  mortalityPercent: 2,
  exitWeightG: 2000,
  avgDailyGainG: 44.44,
  totalFeedKg: 2250,
  feedConversionRatio: 1.148,
  revenueXof: 1_800_000,
  feedCostXof: 900_000,
  chickCostXof: 250_000,
  otherExpenseXof: 90_000,
  totalCostXof: 1_240_000,
  marginXof: 560_000,
  costPerKgXof: 633,
  consumedArticles: 1,
  valuedArticles: 1,
  valuationIncomplete: false,
  notes: null,
};

const reopenUnit = vi.fn(() => ({ unwrap: () => Promise.resolve() }));
let data: UnitClosure = closure;

vi.mock("@/store/api/closureApi", () => ({
  useGetUnitClosureQuery: () => ({ data, isLoading: false, error: undefined }),
  useReopenUnitMutation: () => [reopenUnit, { isLoading: false }],
}));

vi.mock("@/hooks/useFarmRole", () => ({
  useFarmRole: () => "OWNER",
  canManageCatalog: () => true,
}));

function setup(override: Partial<UnitClosure> = {}) {
  data = { ...closure, ...override };
  return renderWithProviders(
    <BatchClosureTab farmId={7} unitId={42} batchName="Bande A" />,
  );
}

describe("BatchClosureTab", () => {
  it("shows the technical and financial figures", () => {
    setup();

    expect(screen.getByText("45 jours")).toBeInTheDocument();
    expect(screen.getByText("2 %")).toBeInTheDocument();
    expect(screen.getByText("1.148")).toBeInTheDocument();
    expect(screen.getByText(/Coût de revient au kg vif/i)).toBeInTheDocument();
  });

  it("warns when some consumed article had no price", () => {
    setup({ consumedArticles: 4, valuedArticles: 2, valuationIncomplete: true });

    expect(screen.getByText(/2 articles consommés n'ont pas de prix/i)).toBeInTheDocument();
    expect(screen.getByText(/le coût réel est plus élevé/i)).toBeInTheDocument();
  });

  it("uses the singular for a single unpriced article", () => {
    setup({ consumedArticles: 2, valuedArticles: 1, valuationIncomplete: true });

    expect(screen.getByText(/1 article consommé n'a pas de prix/i)).toBeInTheDocument();
  });

  it("stays silent when every article was valued", () => {
    setup();

    expect(screen.queryByText(/pas de prix/i)).not.toBeInTheDocument();
  });

  it("shows a dash rather than a zero when the batch was never weighed", () => {
    setup({ exitWeightG: null, costPerKgXof: null, feedConversionRatio: null });

    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("warns that reopening deletes the report before doing it", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("button", { name: /rouvrir la bande/i }));
    // "supprimé" sits inside a <strong>, so match the contiguous run before it.
    expect(await screen.findByText(/le bilan de cette bande sera/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^rouvrir$/i }));
    expect(reopenUnit).toHaveBeenCalledWith({ farmId: 7, unitId: 42 });
  });
});
