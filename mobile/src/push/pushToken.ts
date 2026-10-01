/**
 * The Expo push token this phone registered with the backend, kept so a sign-out can revoke it.
 * SecureStore, like the auth tokens: it identifies a device to the server.
 */
import * as SecureStore from 'expo-secure-store';

const KEY = 'avicare.pushToken';

export const getStoredPushToken = () => SecureStore.getItemAsync(KEY);
export const storePushToken = (token: string) => SecureStore.setItemAsync(KEY, token);
export const clearStoredPushToken = () => SecureStore.deleteItemAsync(KEY);
