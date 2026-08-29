import { baseApi } from "@/store/api/baseApi";
import type { AnnouncementView } from "@/types";

interface Envelope<T> {
  data: T;
}

/** What the platform is telling every signed-in user right now. */
export const announcementsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getActiveAnnouncements: build.query<AnnouncementView[], void>({
      query: () => "/api/v1/announcements",
      transformResponse: (r: Envelope<AnnouncementView[]>) => r.data,
    }),
  }),
});

export const { useGetActiveAnnouncementsQuery } = announcementsApi;
