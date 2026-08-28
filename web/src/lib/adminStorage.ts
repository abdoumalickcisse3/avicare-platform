/**
 * Back-office token store (localStorage, SSR-safe). Keys distinct from BOTH the farmer store
 * (`avicare_*`) and the partner store (`jawdi_partner_*`), so the three sessions never collide —
 * a support engineer routinely has a farmer session open next to the console.
 */
const ADMIN_ACCESS_KEY = "jawdi_admin_access_token";
const ADMIN_REFRESH_KEY = "jawdi_admin_refresh_token";

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

export const adminTokenStorage = {
  getAccess: () => read(ADMIN_ACCESS_KEY),
  getRefresh: () => read(ADMIN_REFRESH_KEY),
  set: (accessToken: string, refreshToken: string) => {
    write(ADMIN_ACCESS_KEY, accessToken);
    write(ADMIN_REFRESH_KEY, refreshToken);
  },
  clear: () => {
    remove(ADMIN_ACCESS_KEY);
    remove(ADMIN_REFRESH_KEY);
  },
};
