import { renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { usePushNotifications } from '../usePushNotifications';
import { obtainPushToken } from '../obtainPushToken';
import { storePushToken } from '../pushToken';

const mockPush = jest.fn();
const mockDispatch = jest.fn();
const mockRegister = jest.fn();
const mockMarkRead = jest.fn();
let mockSelectedFarm: number | null = 1;
let mockLastResponse: unknown = null;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: () => mockSelectedFarm,
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  useLastNotificationResponse: () => mockLastResponse,
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  clearLastNotificationResponse: jest.fn(),
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));
jest.mock('@/store/api/notificationsApi', () => ({
  notificationsApi: { util: { invalidateTags: jest.fn((t) => ({ type: 'invalidate', t })) } },
  useRegisterPushDeviceMutation: () => [mockRegister],
  useMarkNotificationReadMutation: () => [mockMarkRead],
}));
jest.mock('../obtainPushToken', () => ({ obtainPushToken: jest.fn() }));
jest.mock('../pushToken', () => ({ storePushToken: jest.fn(async () => {}) }));

const tap = (data: unknown, identifier = 'n-1') => ({
  actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
  notification: { request: { identifier, content: { data } } },
});

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedFarm = 1;
    mockLastResponse = null;
    mockRegister.mockReturnValue({ unwrap: async () => undefined });
    (obtainPushToken as jest.Mock).mockResolvedValue('ExponentPushToken[abc]');
  });

  it('registers this phone once the session is authorized', async () => {
    await renderHook(() => usePushNotifications(true));

    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith({
        token: 'ExponentPushToken[abc]',
        platform: 'IOS',
      }),
    );
    await waitFor(() => expect(storePushToken).toHaveBeenCalledWith('ExponentPushToken[abc]'));
  });

  it('asks for nothing before the session is authorized', async () => {
    await renderHook(() => usePushNotifications(false));
    expect(obtainPushToken).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('does not remember a token the backend refused', async () => {
    mockRegister.mockReturnValue({ unwrap: async () => Promise.reject(new Error('422')) });
    await renderHook(() => usePushNotifications(true));
    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    expect(storePushToken).not.toHaveBeenCalled();
  });

  it('opens the screen a tapped push is about, marking it read', async () => {
    mockLastResponse = tap({ notificationId: 12, farmId: 1, sourceRef: { unitId: 9 } });
    await renderHook(() => usePushNotifications(true));

    expect(mockMarkRead).toHaveBeenCalledWith({ farmId: 1, id: 12 });
    expect(mockPush).toHaveBeenCalledWith('/(field)/lots/9');
    expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'selection/setSelectedFarmId' }));
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('switches to the notification\'s farm when it is not the selected one', async () => {
    mockLastResponse = tap({ notificationId: 12, farmId: 2, sourceRef: { unitId: 9 } });
    await renderHook(() => usePushNotifications(true));

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'selection/setSelectedFarmId', payload: 2 });
    expect(mockMarkRead).toHaveBeenCalledWith({ farmId: 2, id: 12 });
  });

  it('lands on the bell when the push has no screen of its own', async () => {
    mockLastResponse = tap({ notificationId: 12, farmId: 1 });
    await renderHook(() => usePushNotifications(true));
    expect(mockPush).toHaveBeenCalledWith('/(field)/notifications');
  });

  it('ignores a tap that is not on the notification itself', async () => {
    mockLastResponse = { ...tap({ farmId: 1 }), actionIdentifier: 'dismiss' };
    await renderHook(() => usePushNotifications(true));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('holds a cold-start tap until the session is authorized', async () => {
    mockLastResponse = tap({ notificationId: 12, farmId: 1 });
    const { rerender } = await renderHook(
      ({ on }: { on: boolean }) => usePushNotifications(on),
      { initialProps: { on: false } },
    );
    expect(mockPush).not.toHaveBeenCalled();

    await rerender({ on: true });
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
