import { describe, expect, it } from "vitest";
import { decodeJwtPayload, memberHasPermission } from "./permissions";

// Build a fake JWT (header.payload.signature) with a base64url payload.
function makeJwt(payload: unknown): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `h.${b64}.s`;
}

describe("memberHasPermission", () => {
  it("matches an exact resource:verb", () => {
    expect(memberHasPermission(["inventory:read"], "inventory:read")).toBe(true);
    expect(memberHasPermission(["inventory:read"], "inventory:write")).toBe(false);
  });
  it("honors resource:* wildcard", () => {
    expect(memberHasPermission(["inventory:*"], "inventory:read")).toBe(true);
    expect(memberHasPermission(["inventory:*"], "commercial:read")).toBe(false);
  });
  it("honors the global * wildcard", () => {
    expect(memberHasPermission(["*"], "commercial:write")).toBe(true);
  });
  it("returns false for an empty permission list", () => {
    expect(memberHasPermission([], "inventory:read")).toBe(false);
  });
});

describe("decodeJwtPayload", () => {
  it("decodes the memberships claim", () => {
    const token = makeJwt({
      sub: "5",
      memberships: [{ farmId: 3, farmRole: "FARMER", permissions: ["poultry:read"] }],
    });
    const payload = decodeJwtPayload(token);
    expect(payload?.memberships?.[0]).toEqual({
      farmId: 3,
      farmRole: "FARMER",
      permissions: ["poultry:read"],
    });
  });
  it("returns null for null/garbage tokens", () => {
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload(undefined)).toBeNull();
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
  });
});
