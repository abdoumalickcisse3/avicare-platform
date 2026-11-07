import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GrowthChart } from "./GrowthChart";
import type { ExpectedWeightPoint, WeighingSample } from "@/types";

/**
 * recharts renders nothing substantial in jsdom (ResponsiveContainer measures 0 width), so these
 * tests replace it with minimal stand-ins that expose exactly what GrowthChart hands it: which
 * <Line> series exist, and the merged data rows fed to <LineChart>. That is enough to prove the
 * two behaviours that matter here: no reference line without server data, and no client-side
 * recomputation of points the server did not send.
 */
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  LineChart: ({ children, data }: { children: React.ReactNode; data: unknown }) => (
    <div data-testid="chart-data" data-rows={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Line: ({ dataKey, name }: { dataKey: string; name?: string }) => (
    <div data-testid={`line-${dataKey}`} data-name={name} />
  ),
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

const weighing: WeighingSample = {
  id: 1,
  poultryBatchId: 9,
  sampleDate: "2026-05-20",
  ageDays: 19,
  sampleSize: 10,
  avgWeightG: 820,
  minWeightG: 760,
  maxWeightG: 910,
  stdDeviation: 42.1,
  uniformityPercent: 80,
  notes: null,
};

function rows() {
  return JSON.parse(screen.getByTestId("chart-data").getAttribute("data-rows") ?? "[]") as {
    age: number;
    real: number | null;
    target: number | null;
  }[];
}

describe("GrowthChart", () => {
  it("ne dessine aucune référence quand la courbe attendue est vide", () => {
    render(<GrowthChart weighings={[weighing]} expectedCurve={[]} />);

    expect(screen.queryByTestId("line-target")).not.toBeInTheDocument();
    expect(screen.getByTestId("line-real")).toBeInTheDocument();
    // Pas de référence fabriquée côté client non plus : aucune ligne ne porte de valeur cible.
    expect(rows().every((r) => r.target == null)).toBe(true);
  });

  it("dessine la référence aux points fournis par le serveur, sans interpoler", () => {
    const expectedCurve: ExpectedWeightPoint[] = [
      { ageDays: 0, weightG: 40 },
      { ageDays: 7, weightG: 180 },
      { ageDays: 14, weightG: 400 },
    ];

    render(<GrowthChart weighings={[weighing]} expectedCurve={expectedCurve} />);

    expect(screen.getByTestId("line-target")).toBeInTheDocument();
    const data = rows();
    // Les points du serveur sont repris tels quels, jamais recalculés.
    expect(data.find((r) => r.age === 0)?.target).toBe(40);
    expect(data.find((r) => r.age === 7)?.target).toBe(180);
    expect(data.find((r) => r.age === 14)?.target).toBe(400);
    // La pesée est à J19, un âge que le serveur n'a pas échantillonné : pas de valeur inventée
    // pour combler le trou — l'ancien `targetAt()` l'aurait interpolée.
    expect(data.find((r) => r.age === 19)?.target).toBeNull();
    expect(data.find((r) => r.age === 19)?.real).toBe(820);
  });

  it("affiche un état vide sans pesée", () => {
    render(<GrowthChart weighings={[]} expectedCurve={[]} />);
    expect(screen.getByText(/ajoutez une pesée/i)).toBeInTheDocument();
  });
});
