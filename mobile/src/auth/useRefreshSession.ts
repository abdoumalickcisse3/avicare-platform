import { useCallback } from 'react';
import { useRefreshMutation } from '@/store/api/authApi';
import { getRefreshToken, saveTokens } from '@/auth/tokens';
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
 * <p>No-op when there is no stored refresh token.
 */
export function useRefreshSession(): () => Promise<void> {
  const [refresh] = useRefreshMutation();

  return useCallback(async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return;
    const tokens = await refresh({ refreshToken }).unwrap();
    await saveTokens(tokens);
    notifySessionChanged();
  }, [refresh]);
}
