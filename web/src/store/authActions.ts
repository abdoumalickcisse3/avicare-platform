import { baseApi } from "./api/baseApi";
import { clearAuth } from "./slices/authSlice";
import { setSelectedFarmId } from "./slices/uiSlice";
import type { AppDispatch } from "./store";

/**
 * Full logout. Clears the auth tokens, resets per-user UI state (the selected
 * farm) AND wipes the entire RTK Query cache.
 *
 * The store is a session singleton and logout navigates client-side (no page
 * reload), so without resetApiState() the next account that signs in would
 * briefly see the previous account's cached data (farms, invoices, dashboard…).
 * Centralised here so every logout path stays leak-free.
 */
export const logout = () => (dispatch: AppDispatch) => {
  dispatch(clearAuth());
  dispatch(setSelectedFarmId(null));
  dispatch(baseApi.util.resetApiState());
};
