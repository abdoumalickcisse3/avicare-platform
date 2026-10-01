import { useCallback } from 'react';
import { refreshSession } from '@/auth/refreshSession';
import { notifySessionChanged } from '@/auth/sessionEvents';

/**
 * Rebuild the access token from the stored refresh token.
 *
 * <p>Farm memberships are baked into the access token when it is issued (backend `JwtService`).
 * Right after a farm is created the caller is its OWNER in the database, but the token in hand was
 * minted before the farm existed and carries no membership for it — so every call scoped to that
 * farm answers 403 until the next sign-in. Refreshing re-reads the memberships server-side and
 * mints a token that has them.
 *
 * <p>Mirrors `web/src/hooks/useRefreshSession.ts`. It exists as a primitive rather than as three
 * inline copies because the one place that forgot it (creating a second farm from the Fermes
 * screen) left the whole app answering 403 with no way out but signing out and back in.
 *
 * <p>Goes through the shared single-flight `refreshSession`, so it cannot race a 401 refresh. Throws
 * when the server could not be reached; a rejected token ends the session (login redirect).
 */
export function useRefreshSession(): () => Promise<void> {
  return useCallback(async () => {
    const outcome = await refreshSession();
    if (outcome === 'unreachable') throw new Error('REFRESH_UNREACHABLE');
    if (outcome === 'refreshed') notifySessionChanged();
  }, []);
}
