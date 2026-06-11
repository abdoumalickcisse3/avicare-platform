import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";

const h = vi.hoisted(() => ({
  sub: undefined as
    | {
        id: number;
        farmId: number;
        status: string;
        planKey: string | null;
        expiresAt: string | null;
        modules: { moduleKey: string; mode: string; expiresAt: string | null }[];
      }
    | undefined,
  plans: [
    { key: "starter_volaille", label: "Starter Volaille", priceXof: 15000, modules: ["module.poultry.broiler"], quotas: null, recommended: false, custom: false, wave: "V1" },
    { key: "pro_volaille", label: "Pro Volaille", priceXof: 25000, modules: ["module.poultry.broiler", "module.poultry.layer"], quotas: null, recommended: true, custom: false, wave: "V1" },
    { key: "ferme_complete", label: "Ferme Complète", priceXof: 45000, modules: [], quotas: null, recommended: false, custom: false, wave: "V1" },
    { key: "sur_mesure", label: "Sur mesure", priceXof: null, modules: [], quotas: null, recommended: false, custom: true, wave: "V1" },
  ],
}));

vi.mock("@/store/api/subscriptionApi", () => ({
  useGetSubscriptionQuery: () => ({ data: h.sub, isLoading: false, error: undefined }),
  useGetPlansQuery: () => ({ data: h.plans }),
  useListChangeRequestsQuery: () => ({ data: [] }),
  useCreateChangeRequestMutation: () => [vi.fn(), { isLoading: false }],
  useSubmitChangeRequestMutation: () => [vi.fn(), { isLoading: false }],
}));

import { FarmSubscriptionTab } from "./FarmSubscriptionTab";

beforeEach(() => {
  h.sub = undefined;
});

describe("FarmSubscriptionTab", () => {
  it("renders a TRIAL subscription with expiry and active modules", () => {
    h.sub = {
      id: 1,
      farmId: 3,
      status: "TRIAL",
      planKey: null,
      expiresAt: "2026-10-12T00:00:00",
      modules: [{ moduleKey: "module.poultry.broiler", mode: "HARD", expiresAt: null }],
    };
    renderWithProviders(<FarmSubscriptionTab farmId={3} />);
    expect(screen.getByText("Plan actuel")).toBeInTheDocument();
    expect(screen.getByText("Essai")).toBeInTheDocument();
    expect(screen.getByText(/expire le/i)).toBeInTheDocument();
    // "Volaille chair" shows both as the active-module chip and in plan cards.
    expect(screen.getAllByText("Volaille chair").length).toBeGreaterThan(0);
    // bundle cards available to choose from (starter/pro/complete)
    expect(
      screen.getAllByRole("button", { name: /demander ce plan/i }).length,
    ).toBeGreaterThan(0);
  });

  it("renders an ACTIVE subscription with its current plan marked", () => {
    h.sub = {
      id: 1,
      farmId: 3,
      status: "ACTIVE",
      planKey: "pro_volaille",
      expiresAt: null,
      modules: [],
    };
    renderWithProviders(<FarmSubscriptionTab farmId={3} />);
    expect(screen.getByText("Actif")).toBeInTheDocument();
    // "Pro Volaille" appears in both the current-plan card and the bundle grid
    expect(screen.getAllByText("Pro Volaille").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /plan actuel/i })).toBeDisabled();
  });
});
