import { describe, expect, it } from "vitest";
import { periodToQuery } from "./dashboard";

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
