import { revokePushDevice } from '../revokePushDevice';
import { clearStoredPushToken, getStoredPushToken } from '../pushToken';
import { getAccessToken } from '@/auth/tokens';

jest.mock('../pushToken', () => ({
  getStoredPushToken: jest.fn(),
  clearStoredPushToken: jest.fn(async () => {}),
}));
jest.mock('@/auth/tokens', () => ({ getAccessToken: jest.fn(async () => 'access-1') }));
jest.mock('@/config/apiUrl', () => ({ resolveApiUrl: () => 'https://api.test' }));

const fetchMock = jest.fn(async () => new Response('{}', { status: 200 }));
global.fetch = fetchMock as unknown as typeof fetch;

describe('revokePushDevice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getStoredPushToken as jest.Mock).mockResolvedValue('ExponentPushToken[abc]');
  });

  it('tells the backend to drop this phone, authenticated as the signing-out user', async () => {
    await revokePushDevice();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/api/v1/push-devices/revoke',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer access-1' }),
        body: JSON.stringify({ token: 'ExponentPushToken[abc]' }),
      }),
    );
    expect(clearStoredPushToken).toHaveBeenCalledTimes(1);
  });

  it('does nothing when this phone never registered', async () => {
    (getStoredPushToken as jest.Mock).mockResolvedValue(null);
    await revokePushDevice();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the call when there is no session left to authenticate it', async () => {
    (getAccessToken as jest.Mock).mockResolvedValueOnce(null);
    await revokePushDevice();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never blocks the sign-out when the network is down', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(revokePushDevice()).resolves.toBeUndefined();
  });

  it('keeps the stored token when the backend refuses the revoke', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await revokePushDevice();
    expect(clearStoredPushToken).not.toHaveBeenCalled();
  });
});
