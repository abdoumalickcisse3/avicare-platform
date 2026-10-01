import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { obtainPushToken } from '../obtainPushToken';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } } },
}));

const n = jest.mocked(Notifications);
const perm = (p: { granted: boolean; canAskAgain?: boolean }) =>
  ({ status: p.granted ? 'granted' : 'undetermined', expires: 'never', canAskAgain: true, ...p }) as Notifications.NotificationPermissionsStatus;

describe('obtainPushToken', () => {
  const original = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    n.getPermissionsAsync.mockResolvedValue(perm({ granted: true, canAskAgain: true }));
    n.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: 'ExponentPushToken[abc]' });
  });
  afterAll(() => {
    Platform.OS = original;
  });

  it('returns the Expo token for the EAS project when permission is already granted', async () => {
    expect(await obtainPushToken()).toBe('ExponentPushToken[abc]');
    expect(n.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-1' });
    expect(n.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('asks for permission when it has not been decided yet', async () => {
    n.getPermissionsAsync.mockResolvedValue(perm({ granted: false, canAskAgain: true }));
    n.requestPermissionsAsync.mockResolvedValue(perm({ granted: true }));
    expect(await obtainPushToken()).toBe('ExponentPushToken[abc]');
    expect(n.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('gives no token when the user refuses, and does not ask again after a refusal', async () => {
    n.getPermissionsAsync.mockResolvedValue(perm({ granted: false, canAskAgain: false }));
    expect(await obtainPushToken()).toBeNull();
    expect(n.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(n.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('gives no token off iOS', async () => {
    Platform.OS = 'android';
    expect(await obtainPushToken()).toBeNull();
    expect(n.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('never throws: a simulator without push support just yields no token', async () => {
    n.getExpoPushTokenAsync.mockRejectedValue(new Error('no aps-environment'));
    expect(await obtainPushToken()).toBeNull();
  });
});
