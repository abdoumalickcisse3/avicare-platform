/**
 * Tells the backend this phone no longer belongs to the signed-in user, so the next banner for
 * their farm does not land on a phone they handed on. A plain fetch, like the refresh-token
 * revocation in `signOut`: it runs while the session is being torn down. Best-effort — a failure
 * leaves the token registered, and the next person to sign in on this phone re-claims it anyway.
 */
import { getAccessToken } from '@/auth/tokens';
import { resolveApiUrl } from '@/config/apiUrl';
import { fetchWithTimeout } from '@/config/requestTimeout';
import { clearStoredPushToken, getStoredPushToken } from './pushToken';

export async function revokePushDevice(): Promise<void> {
  try {
    const token = await getStoredPushToken();
    if (!token) return;
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const res = await fetchWithTimeout(`${resolveApiUrl()}/api/v1/push-devices/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ token }),
    });
    // Forget the token only once the backend has dropped it: a refused revoke (expired access
    // token, 5xx) kept silently would claim "no phone registered" while the server still pushes to it.
    if (res.ok) await clearStoredPushToken();
  } catch {
    // Offline or server down: signing out must still go through.
  }
}
