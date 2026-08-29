import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { BenchmarkCard } from "./BenchmarkCard";
import type { BenchmarkComparison } from "@/types";

function mockApi(comparison: BenchmarkComparison) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ data: comparison }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("BenchmarkCard", () => {
  it("compares the farm against the cohort", async () => {
    mockApi({
      available: true,
      unavailableReason: null,
      cohortSize: 7,
      platformMortalityRate: "6.00",
      farmMortalityRate: "4.20",
    });
    renderWithProviders(<BenchmarkCard farmId={8} />);

    expect(await screen.findByText("4.20 %")).toBeInTheDocument();
    expect(screen.getByText("6.00 %")).toBeInTheDocument();
    expect(screen.getByText("7 fermes")).toBeInTheDocument();
    expect(screen.getByText(/perdez moins d'animaux/)).toBeInTheDocument();
  });

  it("says so plainly when the farm is doing worse", async () => {
    mockApi({
      available: true,
      unavailableReason: null,
      cohortSize: 7,
      platformMortalityRate: "4.00",
      farmMortalityRate: "9.10",
    });
    renderWithProviders(<BenchmarkCard farmId={8} />);

    // A comparison that only ever flatters is one nobody acts on.
    expect(await screen.findByText(/perdez plus d'animaux/)).toBeInTheDocument();
  });

  it("renders nothing when the platform has comparison off", async () => {
    mockApi({
      available: false,
      unavailableReason: "La comparaison entre fermes n'est pas activée.",
      cohortSize: 3,
      platformMortalityRate: null,
      farmMortalityRate: null,
    });
    const { container } = renderWithProviders(<BenchmarkCard farmId={8} />);

    // An empty card explaining an absent feature is noise on a screen opened every morning.
    await new Promise((r) => setTimeout(r, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it("explains a cohort that is still too small", async () => {
    mockApi({
      available: false,
      unavailableReason: "Comparaison indisponible : moins de 5 fermes comparables.",
      cohortSize: 3,
      platformMortalityRate: null,
      farmMortalityRate: null,
    });
    renderWithProviders(<BenchmarkCard farmId={8} />);

    // This one resolves on its own as the platform grows, so it is worth explaining.
    expect(await screen.findByText(/moins de 5 fermes comparables/)).toBeInTheDocument();
  });

  it("never claims a rate it was not given", async () => {
    mockApi({
      available: true,
      unavailableReason: null,
      cohortSize: 7,
      platformMortalityRate: "6.00",
      farmMortalityRate: null,
    });
    renderWithProviders(<BenchmarkCard farmId={8} />);

    // A farm with no flock yet must read "—", not "0 %", which would look like perfect husbandry.
    expect(await screen.findByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/perdez/)).not.toBeInTheDocument();
  });
});
