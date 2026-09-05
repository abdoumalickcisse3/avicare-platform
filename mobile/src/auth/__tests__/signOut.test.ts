/**
 * Signing out must leave nothing behind.
 *
 * The two logout buttons used to call `clearTokens` directly, which cleared the tokens and left
 * the persisted RTK Query cache and the selected farm on disk. On a phone that gets handed around
 * a barn, the next person opened the app on the previous account's data.
 */
import { signOut } from '../signOut';
import { clearTokens, getRefreshToken } from '../tokens';
import { notifyAuthInvalidated } from '@/sync';

jest.mock('../tokens', () => ({
  clearTokens: jest.fn(async () => {}),
  getRefreshToken: jest.fn(async () => 'refresh-abc'),
}));
jest.mock('@/sync', () => ({ notifyAuthInvalidated: jest.fn() }));
jest.mock('@/config/apiUrl', () => ({ resolveApiUrl: () => 'https://api.test' }));

const fetchMock = jest.fn(async () => new Response('{}', { status: 200 }));
global.fetch = fetchMock as unknown as typeof fetch;

describe('signOut', () => {
  beforeEach(() => jest.clearAllMocks());

  it('clears the tokens and raises the invalidation signal', async () => {
    await signOut();

    expect(clearTokens).toHaveBeenCalledTimes(1);
    // The signal is what `app/_layout.tsx` listens to in order to purge the persisted cache and
    // the selected farm; clearing tokens alone leaves both on disk.
    expect(notifyAuthInvalidated).toHaveBeenCalledTimes(1);
  });

  it('signals only after the tokens are gone', async () => {
    const order: string[] = [];
    (clearTokens as jest.Mock).mockImplementation(async () => {
      order.push('clear');
    });
    (notifyAuthInvalidated as jest.Mock).mockImplementation(() => {
      order.push('notify');
    });

    await signOut();

    // The purge listener re-reads auth state; firing it first would race a token still present.
    expect(order).toEqual(['clear', 'notify']);
  });

  it('revokes the refresh token server-side before clearing it', async () => {
    // Clearing the phone alone leaves the token valid for its whole lifetime: a copy of it still
    // buys a session long after the farmer thinks they left.
    await signOut();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/auth/logout');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'refresh-abc' });
  });

  it('still signs out locally when the revocation cannot be sent', async () => {
    // A farmer in a dead zone must be able to leave the app; the token then expires on its own.
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    await signOut();

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(notifyAuthInvalidated).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when there is no refresh token to revoke', async () => {
    (getRefreshToken as jest.Mock).mockResolvedValueOnce(null);

    await signOut();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(clearTokens).toHaveBeenCalledTimes(1);
  });
});
