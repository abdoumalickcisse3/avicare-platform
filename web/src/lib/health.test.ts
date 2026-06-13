import { describe, expect, it } from "vitest";
import {
  addDays,
  ageLabel,
  daysBetween,
  humanizeKey,
  projectWithdrawal,
  scheduleStatusColor,
  scheduleStatusLabel,
  severityChip,
} from "./health";
import { colors } from "@/theme/tokens";

describe("daysBetween / addDays", () => {
  it("counts whole days forward and backward", () => {
    expect(daysBetween("2026-01-01", "2026-01-08")).toBe(7);
    expect(daysBetween("2026-01-08", "2026-01-01")).toBe(-7);
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("adds days returning a new ISO date", () => {
    expect(addDays("2026-01-01", 7)).toBe("2026-01-08");
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });
});

describe("projectWithdrawal", () => {
  it("computes endDate inclusive and withdrawal end dates", () => {
    // start 2026-03-01, 3 days => endDate 2026-03-03 (inclusive)
    const p = projectWithdrawal("2026-03-01", 3, 7, 5);
    expect(p.endDate).toBe("2026-03-03");
    expect(p.withdrawalEndDateMeat).toBe("2026-03-10"); // +7
    expect(p.withdrawalEndDateEggs).toBe("2026-03-08"); // +5
  });

  it("returns null withdrawal dates when periods are unknown", () => {
    const p = projectWithdrawal("2026-03-01", 1, null, null);
    expect(p.endDate).toBe("2026-03-01");
    expect(p.withdrawalEndDateMeat).toBeNull();
    expect(p.withdrawalEndDateEggs).toBeNull();
  });
});

describe("ageLabel", () => {
  it("prefixes J for days and S for weeks", () => {
    expect(ageLabel(28, "DAY")).toBe("J28");
    expect(ageLabel(6, "WEEK")).toBe("S6");
  });
});

describe("scheduleStatusColor / label", () => {
  it("maps statuses to the strict palette", () => {
    expect(scheduleStatusColor("DONE")).toBe(colors.success.main);
    expect(scheduleStatusColor("LATE")).toBe(colors.error.main);
    expect(scheduleStatusColor("UPCOMING")).toBe(colors.neutral[400]);
  });
  it("labels statuses in French", () => {
    expect(scheduleStatusLabel("DONE")).toBe("Effectué");
    expect(scheduleStatusLabel("LATE")).toBe("En retard");
    expect(scheduleStatusLabel("UPCOMING")).toBe("À venir");
  });
});

describe("severityChip", () => {
  it("uses error tokens for CRITICAL and warning for WARNING", () => {
    expect(severityChip("CRITICAL").bg).toBe(colors.error.light);
    expect(severityChip("WARNING").bg).toBe(colors.warning.light);
    expect(severityChip("NORMAL").label).toBe("Normal");
  });
});

describe("humanizeKey", () => {
  it("title-cases an underscore key", () => {
    expect(humanizeKey("newcastle_vh")).toBe("Newcastle Vh");
    expect(humanizeKey("amoxicillin")).toBe("Amoxicillin");
  });
});
