/** A single farm membership as carried in the access-JWT `memberships` claim. */
export interface JwtMembership {
  farmId: number;
  farmRole: string;
  permissions: string[];
}

export interface JwtPayload {
  memberships?: JwtMembership[];
}

/**
 * Decode the payload segment of a JWT WITHOUT verifying its signature (the
 * backend is the authority; the client reads memberships for UX gating only).
 * Returns null for a missing or malformed token.
 */
export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    return JSON.parse(atob(b64 + pad)) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Whether `perms` grants `target` (a `resource:verb` string), honoring the
 * `*` and `resource:*` wildcards carried by a membership.
 */
export function memberHasPermission(perms: string[], target: string): boolean {
  if (perms.includes("*")) return true;
  if (perms.includes(target)) return true;
  const resource = target.split(":")[0];
  return perms.includes(`${resource}:*`);
}
