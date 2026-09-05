/**
 * The one way out of a session.
 *
 * <p>Clearing the tokens is not enough: the RTK Query cache and the selected farm are persisted to
 * AsyncStorage, and on a phone that gets handed around a barn the next person would open the app
 * on the previous account's data. `notifyAuthInvalidated` is what `app/_layout.tsx` listens to in
 * order to purge both — the same signal a refresh raises when it gives up, so a deliberate logout
 * and a forced one end in exactly the same state.
 *
 * <p>Nor is clearing the phone enough. The refresh token stays valid server-side for its whole
 * lifetime unless someone says otherwise, so signing out has to reach the backend, which keeps
 * `refresh_tokens.revoked_at` for exactly this. A plain fetch rather than the RTK Query endpoint:
 * this runs while the cache is being torn down, and a mutation dispatched into a store that is
 * about to reset gets aborted before it leaves the phone.
 *
 * <p>The call is best-effort. A farmer in a dead zone must still get out of the app, so a failed
 * revocation never blocks the local sign-out — the token then expires on its own.
 */
import { clearTokens, getRefreshToken } from './tokens';
import { notifyAuthInvalidated } from '@/sync';
import { resolveApiUrl } from '@/config/apiUrl';

async function revokeRefreshToken(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return;
  try {
    await fetch(`${resolveApiUrl()}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Offline or server down: the local sign-out still has to happen.
  }
}

export async function signOut(): Promise<void> {
  await revokeRefreshToken();
  await clearTokens();
  notifyAuthInvalidated();
}
