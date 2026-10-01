import { refreshSession } from '../refreshSession';
import { clearTokens, getRefreshToken, saveTokens } from '../tokens';
import { notifyAuthInvalidated, subscribeAuthInvalidated } from '../sessionEvents';

jest.mock('../tokens', () => ({
  clearTokens: jest.fn(async () => {}),
  getRefreshToken: jest.fn(async () => 'refresh-1'),
  saveTokens: jest.fn(async () => {}),
}));
jest.mock('@/config/apiUrl', () => ({ resolveApiUrl: () => 'https://api.test' }));

const ok = () =>
  new Response(JSON.stringify({ data: { accessToken: 'a2', refreshToken: 'r2' } }), { status: 200 });
const fetchMock = jest.fn(async () => ok());
global.fetch = fetchMock as unknown as typeof fetch;

describe('refreshSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockImplementation(async () => ok());
    (getRefreshToken as jest.Mock).mockResolvedValue('refresh-1');
  });

  it('stores the new pair and reports it refreshed', async () => {
    await expect(refreshSession()).resolves.toBe('refreshed');
    expect(saveTokens).toHaveBeenCalledWith({ accessToken: 'a2', refreshToken: 'r2' });
  });

  it('shares ONE request between concurrent callers — a replayed single-use token signs the account out', async () => {
    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(results).toEqual(['refreshed', 'refreshed', 'refreshed']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('can refresh again once the previous refresh has settled', async () => {
    await refreshSession();
    await refreshSession();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ends the session only when the server rejects the token', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeAuthInvalidated(listener);
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));

    await expect(refreshSession()).resolves.toBe('rejected');

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('keeps the session when the network is down — leaving coverage is not a logout', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network request failed'));

    await expect(refreshSession()).resolves.toBe('unreachable');

    expect(clearTokens).not.toHaveBeenCalled();
  });

  it('keeps the session on a server error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));

    await expect(refreshSession()).resolves.toBe('unreachable');

    expect(clearTokens).not.toHaveBeenCalled();
  });

  it('ends the session when there is no refresh token to present', async () => {
    (getRefreshToken as jest.Mock).mockResolvedValueOnce(null);

    await expect(refreshSession()).resolves.toBe('rejected');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(clearTokens).toHaveBeenCalledTimes(1);
  });
});

describe('auth invalidation signal', () => {
  it('reaches every subscriber until they unsubscribe', () => {
    const a = jest.fn();
    const unsubscribe = subscribeAuthInvalidated(a);
    notifyAuthInvalidated();
    unsubscribe();
    notifyAuthInvalidated();
    expect(a).toHaveBeenCalledTimes(1);
  });
});
