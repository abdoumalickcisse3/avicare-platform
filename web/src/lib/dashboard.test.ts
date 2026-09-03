import { describe, expect, it } from "vitest";
import { periodToQuery, periodToRange } from "./dashboard";

describe("periodToQuery", () => {
  it("maps a preset to ?period=", () => {
    expect(periodToQuery({ kind: "preset", preset: "30d" })).toEqual({ period: "30d" });
  });
  it("maps a custom range to from/to", () => {
    expect(periodToQuery({ kind: "custom", from: "2026-06-01", to: "2026-06-10" })).toEqual({
      from: "2026-06-01",
      to: "2026-06-10",
    });
  });
  it("defaults to 30d when preset missing", () => {
    expect(periodToQuery({ kind: "preset" })).toEqual({ period: "30d" });
  });
});

describe("periodToRange", () => {
  it("keeps an explicit custom range as it is", () => {
    expect(periodToRange({ kind: "custom", from: "2026-06-01", to: "2026-06-10" })).toEqual({
      from: "2026-06-01",
      to: "2026-06-10",
    });
  });

  it("resolves today to a single day", () => {
    const { from, to } = periodToRange({ kind: "preset", preset: "today" });
    expect(from).toBe(to);
  });

  it("resolves 7d to seven inclusive days", () => {
    const { from, to } = periodToRange({ kind: "preset", preset: "7d" });
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    expect(days).toBe(6); // inclusive bounds: 6 gaps span 7 days
  });

  it("resolves mtd to the first of the month", () => {
    const { from } = periodToRange({ kind: "preset", preset: "mtd" });
    expect(from.endsWith("-01")).toBe(true);
  });

  it("falls back to 30 days when no preset is set", () => {
    const { from, to } = periodToRange({ kind: "preset" });
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    expect(days).toBe(29);
  });
});
