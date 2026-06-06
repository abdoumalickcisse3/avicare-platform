import { tokenStorage } from "./storage";

/** Whether a (non-validated) access token is present client-side. */
export function hasAccessToken(): boolean {
  return Boolean(tokenStorage.getAccess());
}

/** Clear all auth data (logout / failed refresh). */
export function clearAuthData(): void {
  tokenStorage.clear();
}
