/**
 * Decodes the access token's JWT claims into the session shape the app cares
 * about (userId, role, farm memberships). No signature verification — the
 * backend already validated the token; this is a read of a trusted payload.
 *
 * `Buffer` does not exist as a global on Hermes (React Native's JS engine),
 * unlike Node. Importing it from the `buffer` package (a transitive dep,
 * pinned explicitly in package.json) gives the same API in both the Jest/Node
 * test environment and at runtime on-device.
 *
 * IMPORTANT: only ever pass the `'base64'` encoding to `Buffer.from`. The
 * `buffer` npm polyfill that Metro bundles for Hermes does NOT implement the
 * `'base64url'` encoding (it throws `TypeError: Unknown encoding: base64url`),
 * even though Node's own core `buffer` module (what Jest resolves the bare
 * `'buffer'` import to) supports it fine. That mismatch let a bug through
 * Jest that broke every login on a real device. JWTs use base64url, so we
 * convert to standard base64 ourselves before decoding.
 */
import { Buffer } from 'buffer';

export type Membership = { farmId: number; farmRole: string; permissions: string[] };
export type Session = { userId: number; role: 'ADMIN' | 'USER'; memberships: Membership[] };

/** Farm roles allowed inside the field app. BUYER (and any other role) is denied. */
const FIELD_ROLES = ['OWNER', 'MANAGER', 'FARMER', 'VETERINARIAN'];

/**
 * Converts a base64url string (as used in JWT segments) to standard base64
 * and decodes it. Never passes `'base64url'` to `Buffer.from` — see the
 * module-level comment above for why.
 */
function decodeBase64Url(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function decodeSession(accessToken: string): Session {
  const part = accessToken.split('.')[1];
  if (!part) throw new Error('Malformed JWT');
  const claims = JSON.parse(decodeBase64Url(part));
  return {
    userId: Number(claims.sub),
    role: claims.role,
    memberships: claims.memberships ?? [],
  };
}

export function hasFieldAccess(session: Session): boolean {
  return session.memberships.some((m) => FIELD_ROLES.includes(m.farmRole));
}
