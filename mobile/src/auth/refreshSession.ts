/**
 * The one way to trade the stored refresh token for a new pair.
 *
 * <p>Refresh tokens are single-use and the backend treats a replayed one as theft: it revokes the
 * whole token family, i.e. signs the user out on every device. Two callers refreshing at the same
 * moment — three screens whose queries all answer 401 together, or a screen and a background sync
 * drain — would present the same token twice. So every caller goes through this function, and
 * concurrent calls share one request.
 *
 * <p>Outcomes are kept apart on purpose: only a server that answers "no" ends the session. A
 * timeout, a dead zone or a 5xx says nothing about the token, and clearing it there logged farmers
 * out the moment they walked out of coverage.
 */
import { clearTokens, getRefreshToken, saveTokens } from './tokens';
import { notifyAuthInvalidated } from './sessionEvents';
import { resolveApiUrl } from '@/config/apiUrl';
import { REQUEST_TIMEOUT_MS } from '@/config/requestTimeout';

export type RefreshOutcome = 'refreshed' | 'rejected' | 'unreachable';

type RefreshBody = { data?: { accessToken?: string; refreshToken?: string } };

async function endSession(): Promise<RefreshOutcome> {
  await clearTokens();
  notifyAuthInvalidated();
  return 'rejected';
}

async function run(): Promise<RefreshOutcome> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return endSession();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${resolveApiUrl()}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
    if (res.status >= 500) return 'unreachable';
    if (!res.ok) return endSession();

    const body = (await res.json().catch(() => undefined)) as RefreshBody | undefined;
    const accessToken = body?.data?.accessToken;
    const nextRefreshToken = body?.data?.refreshToken;
    if (!accessToken || !nextRefreshToken) return 'unreachable';
    await saveTokens({ accessToken, refreshToken: nextRefreshToken });
    return 'refreshed';
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(timer);
  }
}

let inFlight: Promise<RefreshOutcome> | null = null;

export function refreshSession(): Promise<RefreshOutcome> {
  if (!inFlight) {
    inFlight = run().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
