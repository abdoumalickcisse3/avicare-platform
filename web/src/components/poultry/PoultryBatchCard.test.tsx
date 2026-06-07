import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { PoultryBatchCard } from "./PoultryBatchCard";
import type { PoultryBatch } from "@/types";

const batch: PoultryBatch = {
  id: 12,
  farmId: 1,
  breedId: 3,
  name: "Lot Mbour Mars",
  startDate: "2026-05-01",
  status: "ACTIVE",
  currentCount: 4870,
  initialCount: 5000,
  targetWeightG: 2100,
  targetAgeDays: 42,
};

describe("PoultryBatchCard", () => {
  it("renders the name, breed, status chip and a details link", () => {
    renderWithProviders(
      <PoultryBatchCard farmId={1} batch={batch} breedName="Cobb 500" />,
    );
    expect(screen.getByText("Lot Mbour Mars")).toBeInTheDocument();
    expect(screen.getByText("Cobb 500")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /détails/i })).toHaveAttribute(
      "href",
      "/elevage/lots/12",
    );
  });

  it("shows a dash for KPIs until performance data is available", () => {
    renderWithProviders(<PoultryBatchCard farmId={1} batch={batch} />);
    // GMQ, mortalité and FCR fall back to an em dash with no snapshot.
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});
