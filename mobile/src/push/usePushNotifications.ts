/**
 * Push notifications for the field app, mounted once in `(field)/_layout.tsx`.
 *
 * - Once the session is authorized: ask for permission, get the Expo token, register it.
 * - A banner while the app is open, and the bell badge refreshed so it never disagrees with it.
 * - A tap — from a running app or a cold start — switches to the notification's farm, marks it
 *   read and opens the screen it is about.
 */
import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useDispatch, useSelector } from 'react-redux';
import {
  notificationsApi,
  useMarkNotificationReadMutation,
  useRegisterPushDeviceMutation,
} from '@/store/api/notificationsApi';
import { selectSelectedFarmId, setSelectedFarmId } from '@/store/slices/selectionSlice';
import { obtainPushToken } from './obtainPushToken';
import { parsePushData } from './notificationRoute';
import { storePushToken } from './pushToken';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications(enabled: boolean): void {
  const router = useRouter();
  const dispatch = useDispatch();
  const selectedFarmId = useSelector(selectSelectedFarmId);
  const [registerDevice] = useRegisterPushDeviceMutation();
  const [markRead] = useMarkNotificationReadMutation();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const token = await obtainPushToken();
      if (!token || cancelled) return;
      try {
        await registerDevice({ token, platform: 'IOS' }).unwrap();
        await storePushToken(token);
      } catch {
        // Retried at the next launch; the app works without push.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, registerDevice]);

  useEffect(() => {
    if (!enabled) return;
    const sub = Notifications.addNotificationReceivedListener(() => {
      dispatch(
        notificationsApi.util.invalidateTags([
          { type: 'Notification', id: 'feed' },
          { type: 'Notification', id: 'unread' },
        ]),
      );
    });
    return () => sub.remove();
  }, [enabled, dispatch]);

  useEffect(() => {
    if (!enabled || !lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = lastResponse.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;

    const target = parsePushData(lastResponse.notification.request.content.data);
    const farmId = target.farmId ?? selectedFarmId;
    if (target.farmId !== null && target.farmId !== selectedFarmId) {
      dispatch(setSelectedFarmId(target.farmId));
    }
    if (farmId !== null && target.notificationId !== null) {
      markRead({ farmId, id: target.notificationId });
    }
    router.push(target.href as never);
    Notifications.clearLastNotificationResponse();
  }, [enabled, lastResponse, selectedFarmId, dispatch, markRead, router]);
}
