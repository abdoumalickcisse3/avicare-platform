import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";

interface TokenStore {
  getAccess(): string | null;
  getRefresh(): string | null;
  set(access: string, refresh: string): void;
}

interface ReauthOptions {
  rawBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;
  tokens: TokenStore;
  refreshUrl: string;
  /** Purge the session and leave for the login page; only called once the refresh has failed. */
  onSessionLost: () => void;
}

type RefreshedTokens = { accessToken: string; refreshToken: string };

const urlOf = (args: string | FetchArgs) => (typeof args === "string" ? args : args.url);

/**
 * Whether a 401 on this URL means "the session expired" rather than "these credentials are wrong".
 * Login, register and refresh answer 401 for a bad password or a dead refresh token: refreshing
 * (or redirecting) there reloads the login page and swallows the error message the user needs.
 */
export const isAuthEndpoint = (args: string | FetchArgs) => urlOf(args).includes("/auth/");

/**
 * Wraps a base query with ONE refresh shared by every request that hits a 401 at the same time.
 *
 * The backend rotates refresh tokens and treats a reused one as theft, revoking the whole family:
 * a dashboard firing ten requests with an expired access token used to send ten refreshes with the
 * same token, and the second one logged the user out of every device. Concurrent 401s now await a
 * single in-flight refresh. A request that failed with a token another request has since replaced
 * simply retries, without refreshing again.
 */
export function createReauthBaseQuery({
  rawBaseQuery,
  tokens,
  refreshUrl,
  onSessionLost,
}: ReauthOptions): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> {
  let inflight: Promise<boolean> | null = null;

  const refresh = (
    api: Parameters<typeof rawBaseQuery>[1],
    extraOptions: Parameters<typeof rawBaseQuery>[2],
  ): Promise<boolean> => {
    if (!inflight) {
      inflight = (async () => {
        const refreshToken = tokens.getRefresh();
        if (!refreshToken) return false;
        const response = await rawBaseQuery(
          { url: refreshUrl, method: "POST", body: { refreshToken } },
          api,
          extraOptions,
        );
        const data = (response.data as { data?: RefreshedTokens } | undefined)?.data;
        if (!data?.accessToken) return false;
        tokens.set(data.accessToken, data.refreshToken);
        return true;
      })().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  };

  return async (args, api, extraOptions) => {
    const usedAccess = tokens.getAccess();
    const result = await rawBaseQuery(args, api, extraOptions);
    if (result.error?.status !== 401 || isAuthEndpoint(args)) return result;

    const alreadyRefreshed = tokens.getAccess() !== usedAccess;
    if (alreadyRefreshed || (await refresh(api, extraOptions))) {
      return rawBaseQuery(args, api, extraOptions);
    }
    onSessionLost();
    return result;
  };
}
