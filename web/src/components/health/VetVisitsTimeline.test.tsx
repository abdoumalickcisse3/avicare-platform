import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { VetVisitsTimeline } from "./VetVisitsTimeline";

const roleMock = vi.fn(() => "OWNER");
vi.mock("@/hooks/useFarmRole", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useFarmRole")>()),
  useFarmRole: () => roleMock(),
}));

const canMock = vi.fn(() => true);
vi.mock("@/hooks/useFarmPermissions", () => ({
  useFarmPermissions: () => ({ can: () => canMock() }),
}));

const VISIT = {
  id: 9,
  productionUnitId: 4,
  veterinarianId: null,
  visitDate: "2026-09-01",
  reason: "Contrôle de routine",
  diagnosis: null,
  recommendations: null,
  costXof: 15000,
  followUpNeeded: false,
  followUpDate: null,
};

/** Answers the two GETs the timeline makes, and records the DELETE. */
function mockFetch(onDelete?: (url: string) => void) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
      if (method === "DELETE") {
        onDelete?.(url);
        return new Response(null, { status: 204 });
      }
      const data = url.includes("/vet-visits") ? [VISIT] : [];
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

describe("VetVisitsTimeline", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    roleMock.mockReturnValue("OWNER");
    canMock.mockReturnValue(true);
  });

  it("deletes a visit after confirmation, warning that the expense is reversed", async () => {
    const del = vi.fn();
    mockFetch(del);
    renderWithProviders(<VetVisitsTimeline farmId={7} unitId={4} unitName="Lot A" />);

    await userEvent.click(await screen.findByRole("button", { name: /supprimer la visite/i }));
    expect(await screen.findByText(/annulée dans votre comptabilité/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await waitFor(() =>
      expect(del).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/farms/7/health/vet-visits/9"),
      ),
    );
  });

  it("hides the delete button from a member who is not OWNER or MANAGER", async () => {
    roleMock.mockReturnValue("FARMER");
    mockFetch();
    renderWithProviders(<VetVisitsTimeline farmId={7} unitId={4} unitName="Lot A" />);

    expect(await screen.findByText("Contrôle de routine")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /supprimer la visite/i })).toBeNull();
  });
});
