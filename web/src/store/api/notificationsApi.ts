import { baseApi } from "./baseApi";
import type {
  AppNotification,
  NotificationFeed,
  NotificationPreference,
} from "@/types";

/** Backend wraps single-value payloads in { data }; the paged feed is returned as-is. */
interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}`;

/**
 * Unified notifications (Sprint C1) — bell feed, unread badge, mark-read, and per-user
 * delivery preferences (in-app + WhatsApp). Farm-scoped; gated on farm membership on the
 * backend. The feed endpoint returns a raw PageResponse; the others are { data }-wrapped.
 */
export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getNotifications: build.query<
      NotificationFeed,
      { farmId: number; unread?: boolean; page?: number; size?: number }
    >({
      query: ({ farmId, unread = false, page = 0, size = 20 }) =>
        `${base(farmId)}/notifications?unread=${unread}&page=${page}&size=${size}`,
      providesTags: [{ type: "Notification", id: "feed" }],
    }),

    getUnreadCount: build.query<number, { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/notifications/unread-count`,
      transformResponse: (r: ApiEnvelope<{ count: number }>) => r.data.count,
      providesTags: [{ type: "Notification", id: "unread" }],
    }),

    markNotificationRead: build.mutation<void, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({
        url: `${base(farmId)}/notifications/${id}/read`,
        method: "POST",
      }),
      invalidatesTags: [
        { type: "Notification", id: "feed" },
        { type: "Notification", id: "unread" },
      ],
    }),

    markAllNotificationsRead: build.mutation<void, { farmId: number }>({
      query: ({ farmId }) => ({
        url: `${base(farmId)}/notifications/read-all`,
        method: "POST",
      }),
      invalidatesTags: [
        { type: "Notification", id: "feed" },
        { type: "Notification", id: "unread" },
      ],
    }),

    getNotificationPreferences: build.query<NotificationPreference[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/notification-preferences`,
      transformResponse: (r: ApiEnvelope<NotificationPreference[]>) => r.data,
      providesTags: [{ type: "Notification", id: "prefs" }],
    }),

    updateNotificationPreferences: build.mutation<
      void,
      { farmId: number; preferences: NotificationPreference[] }
    >({
      query: ({ farmId, preferences }) => ({
        url: `${base(farmId)}/notification-preferences`,
        method: "PUT",
        body: { preferences },
      }),
      invalidatesTags: [{ type: "Notification", id: "prefs" }],
    }),
  }),
});

export type { AppNotification };
export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} = notificationsApi;
