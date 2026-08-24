/**
 * Partner-portal token store (localStorage, SSR-safe). Distinct keys from the farmer tokenStorage
 * so the two sessions never collide.
 */
const PARTNER_ACCESS_KEY = "jawdi_partner_access_token";
const PARTNER_REFRESH_KEY = "jawdi_partner_refresh_token";

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

export const partnerTokenStorage = {
  getAccess: () => read(PARTNER_ACCESS_KEY),
  getRefresh: () => read(PARTNER_REFRESH_KEY),
  set: (accessToken: string, refreshToken: string) => {
    write(PARTNER_ACCESS_KEY, accessToken);
    write(PARTNER_REFRESH_KEY, refreshToken);
  },
  clear: () => {
    remove(PARTNER_ACCESS_KEY);
    remove(PARTNER_REFRESH_KEY);
  },
};
