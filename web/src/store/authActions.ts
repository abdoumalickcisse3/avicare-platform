import { authApi } from "./api/authApi";
import { baseApi } from "./api/baseApi";
import { clearAuth } from "./slices/authSlice";
import { setSelectedFarmId } from "./slices/uiSlice";
import { tokenStorage } from "@/lib/storage";
import type { AppDispatch } from "./store";

/**
 * Full logout. Revokes the refresh token server-side, clears the auth tokens, resets per-user UI
 * state (the selected farm) AND wipes the entire RTK Query cache.
 *
 * The server call comes first and is best-effort: without it, signing out only cleared this
 * browser and left the refresh token valid for its full lifetime — the backend keeps
 * `refresh_tokens.revoked_at` precisely so a deliberate sign-out closes the session everywhere.
 * A failure (offline, server down) must still let the user out locally, so it is caught.
 *
 * The store is a session singleton and logout navigates client-side (no page
 * reload), so without resetApiState() the next account that signs in would
 * briefly see the previous account's cached data (farms, invoices, dashboard…).
 * Centralised here so every logout path stays leak-free.
 */
export const logout = () => async (dispatch: AppDispatch) => {
  const refreshToken = tokenStorage.getRefresh();
  if (refreshToken) {
    await dispatch(authApi.endpoints.logout.initiate({ refreshToken })).catch(() => {});
  }
  dispatch(clearAuth());
  dispatch(setSelectedFarmId(null));
  dispatch(baseApi.util.resetApiState());
};
