import { baseApi } from "./baseApi";
import type { ActivityItem } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

export const activityApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getFarmActivity: build.query<ActivityItem[], { farmId: number; limit?: number }>({
      query: ({ farmId, limit = 20 }) => `/api/v1/farms/${farmId}/activity?limit=${limit}`,
      transformResponse: (r: ApiEnvelope<ActivityItem[]>) => r.data,
    }),
  }),
});

export const { useGetFarmActivityQuery } = activityApi;
