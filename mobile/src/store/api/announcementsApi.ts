import { baseApi } from './baseApi';
interface ApiEnvelope<T> {
  data: T;
}

/** A platform announcement, authored by staff and addressed to everyone. */
export type AnnouncementView = {
  id: number;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  startsAt: string;
  endsAt: string | null;
  published: boolean;
};

export const announcementsApi = baseApi.injectEndpoints({
  overrideExisting: __DEV__,
  endpoints: (build) => ({
    getActiveAnnouncements: build.query<AnnouncementView[], void>({
      query: () => '/api/v1/announcements',
      transformResponse: (r: ApiEnvelope<AnnouncementView[]>) => r.data,
    }),
  }),
});

export const { useGetActiveAnnouncementsQuery } = announcementsApi;
