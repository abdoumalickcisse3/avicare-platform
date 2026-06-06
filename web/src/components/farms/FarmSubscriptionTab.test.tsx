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
}));

vi.mock("@/store/api/subscriptionApi", () => ({
  useGetSubscriptionQuery: () => ({ data: h.sub, isLoading: false, error: undefined }),
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
    expect(screen.getByText("Volaille chair")).toBeInTheDocument();
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
      planKey: "pro",
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
