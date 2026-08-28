import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { adminTokenStorage } from "@/lib/adminStorage";
import type {
  AdminFarmDetail,
  AdminFarmRow,
  AdminMe,
  AdminUserRow,
  AuthTokens,
  TemporaryPassword,
} from "@/types";

interface Envelope<T> {
  data: T;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl:
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080"),
  prepareHeaders: (headers) => {
    const token = adminTokenStorage.getAccess();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

/**
 * On a 401, refresh once against the shared auth endpoint and retry; on failure purge the staff
 * token and return to the console login.
 *
 * A standalone `createApi`, never `injectEndpoints` on `baseApi`: sharing the slice would send the
 * farmer token to back-office routes and the staff token to tenant routes. Same reasoning as
 * `partnerApi`.
 */
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const refreshToken = adminTokenStorage.getRefresh();
    if (refreshToken) {
      const refresh = await rawBaseQuery(
        { url: "/api/v1/auth/refresh", method: "POST", body: { refreshToken } },
        api,
        extraOptions,
      );
      const data = (refresh.data as { data?: AuthTokens })?.data;
      if (data?.accessToken) {
        adminTokenStorage.set(data.accessToken, data.refreshToken);
        return rawBaseQuery(args, api, extraOptions);
      }
    }
    adminTokenStorage.clear();
    if (typeof window !== "undefined") window.location.href = "/console/login";
  }
  return result;
};

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["AdminMe", "AdminFarm", "AdminUser", "AdminPartner"],
  endpoints: (build) => ({
    /** Staff sign-in reuses the ordinary auth endpoint; the console then checks /admin/me. */
    adminLogin: build.mutation<AuthTokens, { email: string; password: string }>({
      query: (body) => ({ url: "/api/v1/auth/login", method: "POST", body }),
      transformResponse: (r: Envelope<AuthTokens>) => r.data,
    }),
    getAdminMe: build.query<AdminMe, void>({
      query: () => "/api/v1/admin/me",
      transformResponse: (r: Envelope<AdminMe>) => r.data,
      providesTags: ["AdminMe"],
    }),
    getAdminFarms: build.query<AdminFarmRow[], { q?: string } | void>({
      query: (args) => `/api/v1/admin/farms${args?.q ? `?q=${encodeURIComponent(args.q)}` : ""}`,
      transformResponse: (r: Envelope<AdminFarmRow[]>) => r.data,
      providesTags: ["AdminFarm"],
    }),
    getAdminFarm: build.query<AdminFarmDetail, { farmId: number }>({
      query: ({ farmId }) => `/api/v1/admin/farms/${farmId}`,
      transformResponse: (r: Envelope<AdminFarmDetail>) => r.data,
      providesTags: ["AdminFarm"],
    }),
    searchAdminUsers: build.query<AdminUserRow[], { q: string }>({
      query: ({ q }) => `/api/v1/admin/users?q=${encodeURIComponent(q)}`,
      transformResponse: (r: Envelope<AdminUserRow[]>) => r.data,
      providesTags: ["AdminUser"],
    }),
    resetAdminUserPassword: build.mutation<TemporaryPassword, { userId: number }>({
      query: ({ userId }) => ({
        url: `/api/v1/admin/users/${userId}/reset-password`,
        method: "POST",
      }),
      transformResponse: (r: Envelope<TemporaryPassword>) => r.data,
    }),
    impersonate: build.mutation<{ accessToken: string }, { userId: number; reason?: string }>({
      query: (body) => ({ url: "/api/v1/admin/impersonate", method: "POST", body }),
      transformResponse: (r: Envelope<{ accessToken: string }>) => r.data,
    }),
    setAdminUserActive: build.mutation<void, { userId: number; active: boolean }>({
      query: ({ userId, active }) => ({
        url: `/api/v1/admin/users/${userId}/${active ? "activate" : "deactivate"}`,
        method: "POST",
      }),
      invalidatesTags: ["AdminUser"],
    }),
  }),
});

export const {
  useAdminLoginMutation,
  useGetAdminMeQuery,
  useGetAdminFarmsQuery,
  useGetAdminFarmQuery,
  useLazySearchAdminUsersQuery,
  useResetAdminUserPasswordMutation,
  useSetAdminUserActiveMutation,
  useImpersonateMutation,
} = adminApi;
