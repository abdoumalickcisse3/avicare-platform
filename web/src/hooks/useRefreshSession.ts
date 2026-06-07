import { useCallback } from "react";
import { useRefreshMutation } from "@/store/api/authApi";
import { useAppDispatch } from "@/store/hooks";
import { setTokens } from "@/store/slices/authSlice";
import { tokenStorage } from "@/lib/storage";

/**
 * Force-refresh the access token from the current refresh token.
 *
 * Farm memberships are baked into the access token when it is issued (see
 * backend JwtService). After creating a farm, the caller is the OWNER in the
 * DB but their existing token still has no membership for it — owner-only
 * endpoints would 403. Calling this after a farm is created rebuilds the token
 * (the backend reloads memberships from the DB on refresh). No-op if there is
 * no stored refresh token.
 */
export function useRefreshSession() {
  const [refresh] = useRefreshMutation();
  const dispatch = useAppDispatch();

  return useCallback(async () => {
    const refreshToken = tokenStorage.getRefresh();
    if (!refreshToken) return;
    const tokens = await refresh({ refreshToken }).unwrap();
    dispatch(setTokens(tokens));
  }, [refresh, dispatch]);
}
