import { afterEach, describe, expect, it } from "vitest";
import { partnerTokenStorage } from "./partnerStorage";
import { tokenStorage } from "./storage";

describe("partnerTokenStorage", () => {
  afterEach(() => {
    partnerTokenStorage.clear();
    tokenStorage.clear();
  });

  it("round-trips tokens under partner-specific keys", () => {
    partnerTokenStorage.set("acc", "ref");
    expect(partnerTokenStorage.getAccess()).toBe("acc");
    expect(partnerTokenStorage.getRefresh()).toBe("ref");
  });

  it("is isolated from the farmer tokenStorage", () => {
    tokenStorage.set("farmer-acc", "farmer-ref");
    partnerTokenStorage.set("partner-acc", "partner-ref");
    expect(partnerTokenStorage.getAccess()).toBe("partner-acc");
    expect(tokenStorage.getAccess()).toBe("farmer-acc");
    partnerTokenStorage.clear();
    expect(tokenStorage.getAccess()).toBe("farmer-acc"); // clearing one leaves the other
  });
});
