import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { partnerTokenStorage } from "@/lib/partnerStorage";
import type {
  NetworkDashboard,
  NetworkFarmRow,
  PartnerAuthTokens,
  PartnerProfile,
} from "@/types";

interface Envelope<T> {
  data: T;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl:
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080"),
  prepareHeaders: (headers) => {
    const token = partnerTokenStorage.getAccess();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

/**
 * On a 401, try a single refresh against {@code POST /api/v1/partner/auth/refresh} and retry; on
 * failure, purge the partner token and redirect to the partner login. Fully separate from the
 * farmer {@code baseApi} — cloisonnement.
 */
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const refreshToken = partnerTokenStorage.getRefresh();
    if (refreshToken) {
      const refresh = await rawBaseQuery(
        { url: "/api/v1/partner/auth/refresh", method: "POST", body: { refreshToken } },
        api,
        extraOptions,
      );
      const data = (refresh.data as { data?: PartnerAuthTokens })?.data;
      if (data?.accessToken) {
        partnerTokenStorage.set(data.accessToken, data.refreshToken);
        return rawBaseQuery(args, api, extraOptions);
      }
    }
    partnerTokenStorage.clear();
    if (typeof window !== "undefined") window.location.href = "/portal/login";
  }

  return result;
};

export const partnerApi = createApi({
  reducerPath: "partnerApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["PartnerProfile", "Network"],
  endpoints: (build) => ({
    partnerLogin: build.mutation<PartnerAuthTokens, { email: string; password: string }>({
      query: (body) => ({ url: "/api/v1/partner/auth/login", method: "POST", body }),
      transformResponse: (r: Envelope<PartnerAuthTokens>) => r.data,
    }),
    partnerLogout: build.mutation<void, { refreshToken: string }>({
      query: (body) => ({ url: "/api/v1/partner/auth/logout", method: "POST", body }),
    }),
    getPartnerProfile: build.query<PartnerProfile, void>({
      query: () => "/api/v1/partner/me",
      transformResponse: (r: Envelope<PartnerProfile>) => r.data,
      providesTags: ["PartnerProfile"],
    }),
    getNetworkDashboard: build.query<NetworkDashboard, void>({
      query: () => "/api/v1/partner/network",
      transformResponse: (r: Envelope<NetworkDashboard>) => r.data,
      providesTags: ["Network"],
    }),
    getNetworkFarms: build.query<NetworkFarmRow[], void>({
      query: () => "/api/v1/partner/network/farms",
      transformResponse: (r: Envelope<NetworkFarmRow[]>) => r.data,
      providesTags: ["Network"],
    }),
  }),
});

export const {
  usePartnerLoginMutation,
  usePartnerLogoutMutation,
  useGetPartnerProfileQuery,
  useGetNetworkDashboardQuery,
  useGetNetworkFarmsQuery,
} = partnerApi;
