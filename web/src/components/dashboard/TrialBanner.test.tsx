import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";

const h = vi.hoisted(() => ({
  farms: [] as { id: number }[],
  sub: undefined as { status: string; expiresAt: string | null } | undefined,
}));

vi.mock("@/store/api/farmsApi", () => ({
  useGetMyFarmsQuery: () => ({ data: h.farms }),
}));
vi.mock("@/store/api/subscriptionApi", () => ({
  useGetSubscriptionQuery: () => ({ data: h.sub }),
}));

import { TrialBanner } from "./TrialBanner";

beforeEach(() => {
  h.farms = [];
  h.sub = undefined;
  // clear the dismiss cookie between tests
  document.cookie = "avicare_trial_banner_dismissed=; max-age=0; path=/";
});

describe("TrialBanner", () => {
  it("nudges to onboarding when the user has no farm", () => {
    h.farms = [];
    renderWithProviders(<TrialBanner />);
    expect(screen.getByRole("link", { name: /compléter l'onboarding/i })).toHaveAttribute(
      "href",
      "/onboarding",
    );
  });

  it("shows remaining trial days and a plan link when on trial", () => {
    h.farms = [{ id: 3 }];
    h.sub = {
      status: "TRIAL",
      expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    };
    renderWithProviders(<TrialBanner />);
    expect(screen.getByText(/il vous reste 5 jours/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /choisir un plan/i })).toHaveAttribute(
      "href",
      "/fermes/3?tab=subscription",
    );
  });

  it("renders nothing for an active (non-trial) subscription", () => {
    h.farms = [{ id: 3 }];
    h.sub = { status: "ACTIVE", expiresAt: null };
    const { container } = renderWithProviders(<TrialBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("can be dismissed", async () => {
    const user = userEvent.setup();
    h.farms = [{ id: 3 }];
    h.sub = {
      status: "TRIAL",
      expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    };
    renderWithProviders(<TrialBanner />);
    expect(screen.getByText(/il vous reste 5 jours/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /masquer/i }));

    expect(screen.queryByText(/il vous reste 5 jours/i)).not.toBeInTheDocument();
  });
});
