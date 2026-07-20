/**
 * Decodes the access token's JWT claims into the session shape the app cares
 * about (userId, role, farm memberships). No signature verification — the
 * backend already validated the token; this is a read of a trusted payload.
 *
 * `Buffer` does not exist as a global on Hermes (React Native's JS engine),
 * unlike Node. Importing it from the `buffer` package (a transitive dep,
 * pinned explicitly in package.json) gives the same API in both the Jest/Node
 * test environment and at runtime on-device.
 */
import { Buffer } from 'buffer';

export type Membership = { farmId: number; farmRole: string; permissions: string[] };
export type Session = { userId: number; role: 'ADMIN' | 'USER'; memberships: Membership[] };

/** Farm roles allowed inside the field app. BUYER (and any other role) is denied. */
const FIELD_ROLES = ['OWNER', 'MANAGER', 'FARMER', 'VETERINARIAN'];

export function decodeSession(accessToken: string): Session {
  const part = accessToken.split('.')[1];
  if (!part) throw new Error('Malformed JWT');
  const claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  return {
    userId: Number(claims.sub),
    role: claims.role,
    memberships: claims.memberships ?? [],
  };
}

export function hasFieldAccess(session: Session): boolean {
  return session.memberships.some((m) => FIELD_ROLES.includes(m.farmRole));
}
