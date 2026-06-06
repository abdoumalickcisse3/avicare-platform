import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { tokenStorage } from "@/lib/storage";
import type { AuthTokens, UserProfile } from "@/types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  currentUser: UserProfile | null;
}

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  currentUser: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setTokens: (state, action: PayloadAction<AuthTokens>) => {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      tokenStorage.set(action.payload.accessToken, action.payload.refreshToken);
    },
    setCurrentUser: (state, action: PayloadAction<UserProfile | null>) => {
      state.currentUser = action.payload;
    },
    clearAuth: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.currentUser = null;
      tokenStorage.clear();
    },
    /** Rehydrate tokens from localStorage on app boot (client-only). */
    hydrateFromStorage: (state) => {
      state.accessToken = tokenStorage.getAccess();
      state.refreshToken = tokenStorage.getRefresh();
    },
  },
});

export const { setTokens, setCurrentUser, clearAuth, hydrateFromStorage } =
  authSlice.actions;
export default authSlice.reducer;
