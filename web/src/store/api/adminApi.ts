import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { adminTokenStorage } from "@/lib/adminStorage";
import type {
  AnnouncementView,
  PlatformOverview,
  PlatformRuntime,
  WhatsAppFailure,
  WhatsAppUsage,
  AdminFarmDetail,
  AdminFarmRow,
  AdminMe,
  AdminUserRow,
  AuthTokens,
  AdminInviteCode,
  AdminPartnerMembership,
  AdminPartnerRow,
  AdminPartnerUser,
  AdminCatalogCategory,
  AdminCatalogItemRow,
  FarmPurgePreview,
  StaffCatalogResource,
  StaffMemberRow,
  FarmHealthRow,
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
  tagTypes: ["AdminMe", "AdminFarm", "AdminUser", "AdminPartner", "AdminStaff", "AdminCatalog", "AdminCompliance", "AdminMetrics", "AdminAnnouncement"],
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
    setFarmModule: build.mutation<void, { farmId: number; moduleKey: string; enabled: boolean }>({
      query: ({ farmId, moduleKey, enabled }) => ({
        url: `/api/v1/admin/farms/${farmId}/modules/${moduleKey}`,
        method: enabled ? "POST" : "DELETE",
      }),
      invalidatesTags: ["AdminFarm"],
    }),
    getAdminPartners: build.query<AdminPartnerRow[], void>({
      query: () => "/api/v1/admin/partners",
      transformResponse: (r: Envelope<AdminPartnerRow[]>) => r.data,
      providesTags: ["AdminPartner"],
    }),
    getAdminPartner: build.query<AdminPartnerRow, { partnerId: number }>({
      query: ({ partnerId }) => `/api/v1/admin/partners/${partnerId}`,
      transformResponse: (r: Envelope<AdminPartnerRow>) => r.data,
      providesTags: ["AdminPartner"],
    }),
    getAdminPartnerFarms: build.query<AdminPartnerMembership[], { partnerId: number }>({
      query: ({ partnerId }) => `/api/v1/admin/partners/${partnerId}/farms`,
      transformResponse: (r: Envelope<AdminPartnerMembership[]>) => r.data,
      providesTags: ["AdminPartner"],
    }),
    getAdminPartnerUsers: build.query<AdminPartnerUser[], { partnerId: number }>({
      query: ({ partnerId }) => `/api/v1/admin/partners/${partnerId}/users`,
      transformResponse: (r: Envelope<AdminPartnerUser[]>) => r.data,
      providesTags: ["AdminPartner"],
    }),
    getAdminInviteCodes: build.query<AdminInviteCode[], { partnerId: number }>({
      query: ({ partnerId }) => `/api/v1/admin/partners/${partnerId}/invite-codes`,
      transformResponse: (r: Envelope<AdminInviteCode[]>) => r.data,
      providesTags: ["AdminPartner"],
    }),
    detachPartnerFarm: build.mutation<void, { partnerId: number; membershipId: number }>({
      query: ({ partnerId, membershipId }) => ({
        url: `/api/v1/admin/partners/${partnerId}/farms/${membershipId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AdminPartner"],
    }),
    setPartnerUserActive: build.mutation<void, { partnerId: number; partnerUserId: number; active: boolean }>({
      query: ({ partnerId, partnerUserId, active }) => ({
        url: `/api/v1/admin/partners/${partnerId}/users/${partnerUserId}/${active ? "activate" : "deactivate"}`,
        method: "POST",
      }),
      invalidatesTags: ["AdminPartner"],
    }),
    resetPartnerUserPassword: build.mutation<{ temporaryPassword: string }, { partnerId: number; partnerUserId: number }>({
      query: ({ partnerId, partnerUserId }) => ({
        url: `/api/v1/admin/partners/${partnerId}/users/${partnerUserId}/reset-password`,
        method: "POST",
      }),
      transformResponse: (r: Envelope<{ temporaryPassword: string }>) => r.data,
    }),
    revokeInviteCode: build.mutation<void, { partnerId: number; codeId: number }>({
      query: ({ partnerId, codeId }) => ({
        url: `/api/v1/admin/partners/${partnerId}/invite-codes/${codeId}/revoke`,
        method: "POST",
      }),
      invalidatesTags: ["AdminPartner"],
    }),
    getFarmsAtRisk: build.query<FarmHealthRow[], void>({
      query: () => "/api/v1/admin/health/farms-at-risk",
      transformResponse: (r: Envelope<FarmHealthRow[]>) => r.data,
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
    getAnnouncements: build.query<AnnouncementView[], void>({
      query: () => "/api/v1/admin/communication/announcements",
      transformResponse: (r: Envelope<AnnouncementView[]>) => r.data,
      providesTags: ["AdminAnnouncement"],
    }),
    saveAnnouncement: build.mutation<
      AnnouncementView,
      {
        id?: number;
        title: string;
        body: string;
        severity: string;
        startsAt: string;
        endsAt: string | null;
        published: boolean;
      }
    >({
      query: ({ id, ...body }) => ({
        url: id
          ? `/api/v1/admin/communication/announcements/${id}`
          : "/api/v1/admin/communication/announcements",
        method: id ? "PUT" : "POST",
        body,
      }),
      transformResponse: (r: Envelope<AnnouncementView>) => r.data,
      invalidatesTags: ["AdminAnnouncement"],
    }),
    getBroadcastRecipients: build.query<{ count: number }, void>({
      query: () => "/api/v1/admin/communication/broadcast/recipients",
      transformResponse: (r: Envelope<{ count: number }>) => r.data,
    }),
    sendBroadcast: build.mutation<{ queued: number }, { message: string; farmIds: number[] }>({
      query: (body) => ({ url: "/api/v1/admin/communication/broadcast", method: "POST", body }),
      transformResponse: (r: Envelope<{ queued: number }>) => r.data,
      invalidatesTags: ["AdminMetrics"],
    }),
    getBenchmarkCohort: build.query<
      {
        enabled: boolean;
        minCohort: number;
        cohortSize: number;
        available: boolean;
        platformMortalityRate: string;
      },
      void
    >({
      query: () => "/api/v1/admin/benchmarks",
      transformResponse: (r: Envelope<{
        enabled: boolean;
        minCohort: number;
        cohortSize: number;
        available: boolean;
        platformMortalityRate: string;
      }>) => r.data,
      providesTags: ["AdminMetrics"],
    }),
    getPlatformOverview: build.query<PlatformOverview, void>({
      query: () => "/api/v1/admin/metrics/overview",
      transformResponse: (r: Envelope<PlatformOverview>) => r.data,
      providesTags: ["AdminMetrics"],
    }),
    getPlatformRuntime: build.query<PlatformRuntime, void>({
      query: () => "/api/v1/admin/metrics/runtime",
      transformResponse: (r: Envelope<PlatformRuntime>) => r.data,
      providesTags: ["AdminMetrics"],
    }),
    getWhatsAppUsage: build.query<WhatsAppUsage, { days: number }>({
      query: ({ days }) => `/api/v1/admin/metrics/whatsapp?days=${days}`,
      transformResponse: (r: Envelope<WhatsAppUsage>) => r.data,
      providesTags: ["AdminMetrics"],
    }),
    getWhatsAppFailures: build.query<WhatsAppFailure[], void>({
      query: () => "/api/v1/admin/metrics/whatsapp/failures",
      transformResponse: (r: Envelope<WhatsAppFailure[]>) => r.data,
      providesTags: ["AdminMetrics"],
    }),
    retryWhatsApp: build.mutation<{ requeued: boolean }, { outboxId: number }>({
      query: ({ outboxId }) => ({
        url: `/api/v1/admin/metrics/whatsapp/${outboxId}/retry`,
        method: "POST",
      }),
      transformResponse: (r: Envelope<{ requeued: boolean }>) => r.data,
      invalidatesTags: ["AdminMetrics"],
    }),
    getDeletedFarms: build.query<FarmPurgePreview[], void>({
      query: () => "/api/v1/admin/compliance/farms/deleted",
      transformResponse: (r: Envelope<FarmPurgePreview[]>) => r.data,
      providesTags: ["AdminCompliance"],
    }),
    /** Returns the bundle so the screen can hand it to the browser as a file. */
    exportFarmData: build.mutation<Record<string, unknown>, { farmId: number }>({
      query: ({ farmId }) => `/api/v1/admin/compliance/farms/${farmId}/export`,
      transformResponse: (r: Envelope<Record<string, unknown>>) => r.data,
      invalidatesTags: ["AdminCompliance"],
    }),
    purgeFarm: build.mutation<void, { farmId: number; confirmationName: string }>({
      query: ({ farmId, confirmationName }) => ({
        url: `/api/v1/admin/compliance/farms/${farmId}`,
        method: "DELETE",
        body: { confirmationName },
      }),
      invalidatesTags: ["AdminCompliance", "AdminFarm"],
    }),
    anonymizeUser: build.mutation<{ email: string }, { userId: number }>({
      query: ({ userId }) => ({
        url: `/api/v1/admin/compliance/users/${userId}/anonymize`,
        method: "POST",
      }),
      transformResponse: (r: Envelope<{ email: string }>) => r.data,
      invalidatesTags: ["AdminUser"],
    }),
    getCatalogCategories: build.query<AdminCatalogCategory[], void>({
      query: () => "/api/v1/admin/catalog/categories",
      transformResponse: (r: Envelope<AdminCatalogCategory[]>) => r.data,
      providesTags: ["AdminCatalog"],
    }),
    getCatalogItems: build.query<AdminCatalogItemRow[], { category: string }>({
      query: ({ category }) => `/api/v1/admin/catalog?category=${encodeURIComponent(category)}`,
      transformResponse: (r: Envelope<AdminCatalogItemRow[]>) => r.data,
      providesTags: ["AdminCatalog"],
    }),
    createCatalogItem: build.mutation<
      AdminCatalogItemRow,
      { category: string; key: string; locale?: string | null; value: Record<string, unknown>; active: boolean }
    >({
      query: (body) => ({ url: "/api/v1/admin/catalog", method: "POST", body }),
      transformResponse: (r: Envelope<AdminCatalogItemRow>) => r.data,
      invalidatesTags: ["AdminCatalog"],
    }),
    updateCatalogItem: build.mutation<
      AdminCatalogItemRow,
      { id: number; category: string; key: string; locale?: string | null; value: Record<string, unknown>; active: boolean }
    >({
      query: ({ id, ...body }) => ({ url: `/api/v1/admin/catalog/${id}`, method: "PUT", body }),
      transformResponse: (r: Envelope<AdminCatalogItemRow>) => r.data,
      invalidatesTags: ["AdminCatalog"],
    }),
    getStaff: build.query<StaffMemberRow[], void>({
      query: () => "/api/v1/admin/staff",
      transformResponse: (r: Envelope<StaffMemberRow[]>) => r.data,
      providesTags: ["AdminStaff"],
    }),
    /** The taxonomy comes from the server so the screen never duplicates it. */
    getStaffCatalog: build.query<StaffCatalogResource[], void>({
      query: () => "/api/v1/admin/staff/catalog",
      transformResponse: (r: Envelope<StaffCatalogResource[]>) => r.data,
    }),
    grantStaff: build.mutation<StaffMemberRow, { userId: number }>({
      query: ({ userId }) => ({ url: `/api/v1/admin/staff/${userId}`, method: "POST" }),
      transformResponse: (r: Envelope<StaffMemberRow>) => r.data,
      invalidatesTags: ["AdminStaff", "AdminUser"],
    }),
    revokeStaff: build.mutation<void, { userId: number }>({
      query: ({ userId }) => ({ url: `/api/v1/admin/staff/${userId}`, method: "DELETE" }),
      invalidatesTags: ["AdminStaff", "AdminUser"],
    }),
    setStaffPermissions: build.mutation<StaffMemberRow, { userId: number; permissions: string[] }>({
      query: ({ userId, permissions }) => ({
        url: `/api/v1/admin/staff/${userId}/permissions`,
        method: "PUT",
        body: { permissions },
      }),
      transformResponse: (r: Envelope<StaffMemberRow>) => r.data,
      // Also AdminMe: an operator editing their own console sees the menu follow.
      invalidatesTags: ["AdminStaff", "AdminMe"],
    }),
  }),
});

export const {
  useGetBenchmarkCohortQuery,
  useGetAnnouncementsQuery,
  useSaveAnnouncementMutation,
  useGetBroadcastRecipientsQuery,
  useSendBroadcastMutation,
  useGetPlatformOverviewQuery,
  useGetPlatformRuntimeQuery,
  useGetWhatsAppUsageQuery,
  useGetWhatsAppFailuresQuery,
  useRetryWhatsAppMutation,
  useGetDeletedFarmsQuery,
  useExportFarmDataMutation,
  usePurgeFarmMutation,
  useAnonymizeUserMutation,
  useGetCatalogCategoriesQuery,
  useGetCatalogItemsQuery,
  useCreateCatalogItemMutation,
  useUpdateCatalogItemMutation,
  useGetStaffQuery,
  useGetStaffCatalogQuery,
  useGrantStaffMutation,
  useRevokeStaffMutation,
  useSetStaffPermissionsMutation,
  useAdminLoginMutation,
  useGetAdminMeQuery,
  useGetAdminFarmsQuery,
  useGetAdminFarmQuery,
  useSetFarmModuleMutation,
  useGetFarmsAtRiskQuery,
  useGetAdminPartnersQuery,
  useGetAdminPartnerQuery,
  useGetAdminPartnerFarmsQuery,
  useGetAdminPartnerUsersQuery,
  useGetAdminInviteCodesQuery,
  useDetachPartnerFarmMutation,
  useSetPartnerUserActiveMutation,
  useResetPartnerUserPasswordMutation,
  useRevokeInviteCodeMutation,
  useLazySearchAdminUsersQuery,
  useResetAdminUserPasswordMutation,
  useSetAdminUserActiveMutation,
  useImpersonateMutation,
} = adminApi;
