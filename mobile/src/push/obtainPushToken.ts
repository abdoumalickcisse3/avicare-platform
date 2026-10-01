/**
 * Asks iOS for permission and returns this phone's Expo push token, or null when there is no
 * token to be had: not iOS, permission refused, a simulator, or no network. Never throws — a
 * phone that cannot receive pushes still has to run the app.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

export async function obtainPushToken(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    let status = await Notifications.getPermissionsAsync();
    if (!status.granted && status.canAskAgain) {
      status = await Notifications.requestPermissionsAsync();
    }
    if (!status.granted) return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token.data;
  } catch {
    return null;
  }
}
