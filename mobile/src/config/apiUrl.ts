/**
 * Single source of truth for the backend base URL, shared by the RTK Query
 * client (`store/api/baseApi`) and the offline sync engine (`sync/index`).
 *
 * A physical phone or an emulator can't reach the dev machine via `localhost`
 * — that name resolves to the device itself, so requests silently never leave
 * the phone (this is why offline saisies and login both failed on Android).
 * When the configured URL is a loopback address (the dev default), we rewrite
 * its host to the machine actually serving Metro, which `expo-constants`
 * exposes as `hostUri` / `debuggerHost` (e.g. "192.168.1.74:8081"). The phone
 * reaches the dev machine on that same LAN IP, on the backend port (8080).
 *
 * An explicit non-loopback `extra.apiUrl` (staging/prod) is always honoured.
 */
import Constants from 'expo-constants';

export function resolveApiUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const isLoopback = !configured || /\/\/(localhost|127\.0\.0\.1)/.test(configured);
  if (!isLoopback) return configured;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:8080`;

  return configured ?? 'http://localhost:8080';
}
