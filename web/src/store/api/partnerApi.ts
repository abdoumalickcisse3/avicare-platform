import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { partnerTokenStorage } from "@/lib/partnerStorage";
import { createReauthBaseQuery } from "./reauth";
import type {
  NetworkDashboard,
  NetworkFarmRow,
  PartnerAlert,
  PartnerAuthTokens,
  PartnerProfile,
  RestockForecast,
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
 * On a 401, one shared refresh against {@code POST /api/v1/partner/auth/refresh} then a retry; if
 * that fails, purge the partner token and redirect to the partner login. Fully separate from the
 * farmer {@code baseApi} — cloisonnement.
 */
const baseQueryWithReauth = createReauthBaseQuery({
  rawBaseQuery,
  tokens: partnerTokenStorage,
  refreshUrl: "/api/v1/partner/auth/refresh",
  onSessionLost: () => {
    partnerTokenStorage.clear();
    if (typeof window !== "undefined") window.location.href = "/portal/login";
  },
});

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
    /**
     * One farm's current figures. Same shape as a table row, and that is the point: the table is a
     * snapshot from page load, and a partner deciding whether to call a farmer should see where it
     * stands now, not where it stood when the page opened.
     */
    getNetworkFarm: build.query<NetworkFarmRow, number>({
      query: (farmId) => `/api/v1/partner/network/farms/${farmId}`,
      transformResponse: (r: Envelope<NetworkFarmRow>) => r.data,
      providesTags: ["Network"],
    }),
    getRestockForecast: build.query<RestockForecast, { horizonDays?: number } | void>({
      query: (args) => `/api/v1/partner/network/restock?horizonDays=${args?.horizonDays ?? 30}`,
      transformResponse: (r: Envelope<RestockForecast>) => r.data,
      providesTags: ["Network"],
    }),
    getNetworkAlerts: build.query<PartnerAlert[], void>({
      query: () => "/api/v1/partner/network/alerts",
      transformResponse: (r: Envelope<PartnerAlert[]>) => r.data,
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
  useGetNetworkFarmQuery,
  useGetNetworkAlertsQuery,
  useGetRestockForecastQuery,
} = partnerApi;
