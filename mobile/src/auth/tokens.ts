/**
 * Access/refresh token storage — expo-secure-store only.
 *
 * Unlike the web app (`web/src/lib/storage.ts`, synchronous localStorage),
 * SecureStore is async, and RTK Query's `prepareHeaders` supports async
 * callbacks — callers `await` these functions instead of reading a
 * synchronous cache. Never persisted through AsyncStorage or Redux state.
 */
import * as SecureStore from 'expo-secure-store';

const ACCESS = 'avicare.accessToken';
const REFRESH = 'avicare.refreshToken';

export type AuthTokens = { accessToken: string; refreshToken: string };

export async function saveTokens(t: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(ACCESS, t.accessToken);
  await SecureStore.setItemAsync(REFRESH, t.refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
}
