import { describe, expect, it } from "vitest";
import {
  defaultTimeslotForNow,
  remainingToDistribute,
  selectLayerUnits,
  sortGradeKeys,
  timeslotLabel,
} from "./layer";

describe("layer helpers", () => {
  it("labels known time-slots and falls back to the raw key", () => {
    expect(timeslotLabel("morning")).toBe("Matin");
    expect(timeslotLabel("custom")).toBe("custom");
  });

  it("sorts grades in canonical order, unknowns last", () => {
    expect(sortGradeKeys(["XL", "S", "M", "L"])).toEqual(["S", "M", "L", "XL"]);
    expect(sortGradeKeys(["Z", "S"])).toEqual(["S", "Z"]);
  });

  it("picks the time-slot from the current hour", () => {
    const slots = ["morning", "noon", "evening"];
    expect(defaultTimeslotForNow(slots, new Date("2026-06-10T08:00:00"))).toBe("morning");
    expect(defaultTimeslotForNow(slots, new Date("2026-06-10T12:00:00"))).toBe("noon");
    expect(defaultTimeslotForNow(slots, new Date("2026-06-10T18:00:00"))).toBe("evening");
  });

  it("falls back to the first configured slot when the preferred one is absent", () => {
    expect(defaultTimeslotForNow(["afternoon"], new Date("2026-06-10T08:00:00"))).toBe(
      "afternoon",
    );
  });

  it("computes remaining eggs to distribute, clamped at 0", () => {
    expect(remainingToDistribute(100, { S: 30, M: 40 })).toBe(30);
    expect(remainingToDistribute(50, { S: 60 })).toBe(0);
    expect(remainingToDistribute(20, {})).toBe(20);
  });

  it("selects layer units as poultry units that are not broiler batches", () => {
    const units = [
      { id: 1, species: "POULTRY" },
      { id: 2, species: "POULTRY" },
      { id: 3, species: "CATTLE" },
    ];
    expect(selectLayerUnits(units, new Set([1]))).toEqual([{ id: 2, species: "POULTRY" }]);
  });
});
