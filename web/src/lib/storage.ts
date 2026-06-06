/**
 * Thin localStorage wrapper, SSR-safe (no-ops when `window` is undefined).
 *
 * NOTE (V1 debt): tokens live in localStorage because the backend does not yet
 * set httpOnly cookies (cf. A3-2). doc 07 §5 prescribes access-in-memory +
 * refresh-in-httpOnly-cookie; align there when the backend provides cookies.
 */
const ACCESS_TOKEN_KEY = "avicare_access_token";
const REFRESH_TOKEN_KEY = "avicare_refresh_token";

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function write(key: string, value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export const tokenStorage = {
  getAccess: () => read(ACCESS_TOKEN_KEY),
  getRefresh: () => read(REFRESH_TOKEN_KEY),
  set: (accessToken: string, refreshToken: string) => {
    write(ACCESS_TOKEN_KEY, accessToken);
    write(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: () => {
    remove(ACCESS_TOKEN_KEY);
    remove(REFRESH_TOKEN_KEY);
  },
};
