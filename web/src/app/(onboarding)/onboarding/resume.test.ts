import { describe, expect, it } from "vitest";
import { decideResume } from "./resume";
import type { Farm } from "@/types";

const farm = { id: 42 } as Farm;

describe("decideResume", () => {
  it("redirects when onboarding is already completed", () => {
    expect(
      decideResume({ onboardingCompleted: true, farms: [farm], activeModuleCount: 3 }),
    ).toEqual({ kind: "completed" });
  });

  it("starts at step 1 when the user has no farm", () => {
    expect(
      decideResume({ onboardingCompleted: false, farms: [], activeModuleCount: 0 }),
    ).toEqual({ kind: "step", step: 1 });
  });

  it("resumes at step 2 when a farm exists but no module is active", () => {
    expect(
      decideResume({ onboardingCompleted: false, farms: [farm], activeModuleCount: 0 }),
    ).toEqual({ kind: "step", step: 2, farmId: 42 });
  });

  it("resumes at step 3 when a farm has active modules", () => {
    expect(
      decideResume({ onboardingCompleted: false, farms: [farm], activeModuleCount: 2 }),
    ).toEqual({ kind: "step", step: 3, farmId: 42 });
  });
});
