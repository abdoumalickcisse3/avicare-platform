import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";

vi.mock("@/store/api/membersApi", () => ({
  useGetMembersQuery: () => ({
    data: [
      { id: 1, userId: 5, farmId: 1, role: "OWNER", permissions: ["*"], active: true },
      { id: 2, userId: 9, farmId: 1, role: "FARMER", permissions: [], active: false },
    ],
    isLoading: false,
    error: undefined,
  }),
  useRemoveMemberMutation: () => [vi.fn(), { isLoading: false }],
  useInviteMemberMutation: () => [vi.fn(), { isLoading: false }],
}));

import { FarmTeamTab } from "./FarmTeamTab";

describe("FarmTeamTab", () => {
  it("renders members as id + role label + status", () => {
    renderWithProviders(<FarmTeamTab farmId={1} />);
    expect(screen.getByText("Utilisateur #5")).toBeInTheDocument();
    expect(screen.getByText("Propriétaire")).toBeInTheDocument();
    expect(screen.getByText("Éleveur")).toBeInTheDocument();
    expect(screen.getByText("Inactif")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /inviter un membre/i }),
    ).toBeInTheDocument();
  });

  it("disables removal for the OWNER role only", () => {
    renderWithProviders(<FarmTeamTab farmId={1} />);
    expect(
      screen.getByRole("button", { name: /retirer l'utilisateur 5/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /retirer l'utilisateur 9/i }),
    ).toBeEnabled();
  });
});
