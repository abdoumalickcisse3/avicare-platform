import { describe, expect, it } from "vitest";
import {
  reconstructFlockCurve,
  summarizeAttrition,
  deriveLayingOnset,
} from "./flock";
import type { LifecycleEvent } from "@/types";

function ev(p: Partial<LifecycleEvent>): LifecycleEvent {
  return {
    id: p.id ?? 1,
    productionUnitId: 1,
    eventType: p.eventType ?? "MORTALITY",
    quantityDelta: p.quantityDelta ?? 0,
    reason: p.reason ?? null,
    details: p.details ?? {},
    occurredAt: p.occurredAt ?? "2026-03-01T08:00:00",
  };
}

const EVENTS: LifecycleEvent[] = [
  ev({ id: 1, eventType: "CREATED", quantityDelta: 1000, occurredAt: "2026-03-01T08:00:00" }),
  ev({ id: 2, eventType: "MORTALITY", quantityDelta: -3, occurredAt: "2026-06-25T08:00:00" }),
  ev({ id: 3, eventType: "REFORM", quantityDelta: -10, occurredAt: "2026-06-29T08:00:00" }),
];

describe("reconstructFlockCurve", () => {
  it("accumulates deltas chronologically starting from 0", () => {
    // Pass events out of order to prove it sorts by occurredAt.
    const curve = reconstructFlockCurve([EVENTS[2], EVENTS[0], EVENTS[1]]);
    expect(curve).toEqual([
      { date: "2026-03-01", count: 1000 },
      { date: "2026-06-25", count: 997 },
      { date: "2026-06-29", count: 987 },
    ]);
  });

  it("returns an empty array for no events", () => {
    expect(reconstructFlockCurve([])).toEqual([]);
  });
});

describe("summarizeAttrition", () => {
  it("separates mortality and reform and computes attrition pct", () => {
    const s = summarizeAttrition(EVENTS);
    expect(s).toEqual({
      initial: 1000,
      mortality: 3,
      reform: 10,
      current: 987,
      attritionPct: 1.3,
    });
  });

  it("is zero-safe when there are no events", () => {
    expect(summarizeAttrition([])).toEqual({
      initial: 0,
      mortality: 0,
      reform: 0,
      current: 0,
      attritionPct: 0,
    });
  });
});

describe("deriveLayingOnset", () => {
  it("returns the earliest closed production date with eggs", () => {
    const productions = [
      { productionDate: "2026-05-20", totalEggsCollected: 0 },
      { productionDate: "2026-05-12", totalEggsCollected: 120 },
      { productionDate: "2026-05-15", totalEggsCollected: 200 },
    ] as unknown as Parameters<typeof deriveLayingOnset>[0];
    expect(deriveLayingOnset(productions, [])).toBe("2026-05-12");
  });

  it("falls back to the earliest collection with eggs", () => {
    const collections = [
      { collectionDate: "2026-05-18", totalEggs: 50 },
      { collectionDate: "2026-05-16", totalEggs: 30 },
    ] as unknown as Parameters<typeof deriveLayingOnset>[1];
    expect(deriveLayingOnset([], collections)).toBe("2026-05-16");
  });

  it("returns null when nothing has eggs", () => {
    expect(deriveLayingOnset([], [])).toBeNull();
  });
});
