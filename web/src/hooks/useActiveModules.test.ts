import { describe, expect, it } from "vitest";
import { computeActiveModules } from "./useActiveModules";
import type { Subscription } from "@/types";

function sub(modules: Subscription["modules"]): Subscription {
  return {
    id: 1,
    farmId: 1,
    status: "ACTIVE",
    planKey: null,
    expiresAt: null,
    modules,
  };
}

describe("computeActiveModules", () => {
  it("returns [] for an undefined subscription", () => {
    expect(computeActiveModules(undefined)).toEqual([]);
  });

  it("keeps only HARD modules", () => {
    expect(
      computeActiveModules(
        sub([
          { moduleKey: "module.poultry.broiler", mode: "HARD", expiresAt: null },
          { moduleKey: "module.poultry.layer", mode: "OFF", expiresAt: null },
        ]),
      ),
    ).toEqual(["module.poultry.broiler"]);
  });

  it("drops modules past their expiry", () => {
    expect(
      computeActiveModules(
        sub([
          { moduleKey: "module.poultry.layer", mode: "HARD", expiresAt: "2000-01-01T00:00:00" },
          { moduleKey: "module.poultry.broiler", mode: "HARD", expiresAt: "2999-01-01T00:00:00" },
        ]),
      ),
    ).toEqual(["module.poultry.broiler"]);
  });
});
