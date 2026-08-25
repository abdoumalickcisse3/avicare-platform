import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { partnerTokenStorage } from "@/lib/partnerStorage";
import RestockForecast from "./RestockForecast";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

function row(over: Record<string, unknown> = {}) {
  return {
    farmId: 1,
    farmName: "Ferme A",
    unitId: 7,
    batchName: "Bande 7",
    headcount: 480,
    expectedEndDate: "2026-09-06",
    daysToEnd: 12,
    estimatedFeedKg: 720,
    forecastMethod: "GROWTH",
    ...over,
  };
}

function mockForecast(rows: unknown[], estimatedFeedKg = 720, batchCount = 1) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: { summary: { horizonDays: 30, batchCount, estimatedFeedKg }, rows } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ),
  );
}

beforeEach(() => partnerTokenStorage.set("ptoken", "pref"));
afterEach(() => {
  vi.unstubAllGlobals();
  partnerTokenStorage.clear();
});

describe("RestockForecast", () => {
  it("shows the upcoming tonnage and the batches behind it", async () => {
    mockForecast([row()]);
    renderWithProviders(<RestockForecast />);

    expect(await screen.findByText("Ferme A")).toBeInTheDocument();
    expect(screen.getByText("Bande 7")).toBeInTheDocument();
    // Presented as a floor: the estimate extrapolates a rate that rises with the birds' age.
    expect(screen.getAllByText(/^≥\s720\skg$/)).toHaveLength(2); // KPI + row
  });

  it("flags a date computed from the target age rather than real growth", async () => {
    mockForecast([row({ forecastMethod: "THEORETICAL" })]);
    renderWithProviders(<RestockForecast />);

    const line = (await screen.findByText("Ferme A")).closest("tr")!;
    expect(within(line).getByText("théorique")).toBeInTheDocument();
  });

  it("shows a dash when the farm has no feed rate to extrapolate", async () => {
    mockForecast([row({ estimatedFeedKg: null })], 0, 1);
    renderWithProviders(<RestockForecast />);

    const line = (await screen.findByText("Ferme A")).closest("tr")!;
    // Unknown, never rendered as a zero tonnage.
    expect(within(line).getByText("—")).toBeInTheDocument();
  });

  it("names the reason when nothing is shared", async () => {
    mockForecast([], 0, 0);
    renderWithProviders(<RestockForecast />);

    // A partner must not read a farmer's choice as a broken screen.
    expect(
      await screen.findByText(/ne partage encore ses prévisions de recommande/i),
    ).toBeInTheDocument();
  });

  it("exports the rows as a CSV file", async () => {
    mockForecast([row()]);
    // Patch the two statics only — replacing URL wholesale breaks fetchBaseQuery's `new URL(...)`.
    // Typed param, and used: an untyped `vi.fn(() => …)` makes mock.calls a `[][]`, and
    // `calls[0]?.[0]` then fails tsc with TS2493 (green under vitest, red on the build).
    const createObjectURL = vi.fn((blob: Blob) => `blob:${blob.type}`);
    const revokeObjectURL = vi.fn();
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    try {
      renderWithProviders(<RestockForecast />);
      await userEvent.click(await screen.findByRole("button", { name: /exporter/i }));

      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(createObjectURL.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
      expect(revokeObjectURL).toHaveBeenCalledOnce();
    } finally {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    }
  });
});
