import { baseApi } from "./baseApi";
import type { Subscription } from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

export const subscriptionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSubscription: build.query<Subscription, number>({
      query: (farmId) => `/api/v1/farms/${farmId}/subscription`,
      transformResponse: (r: ApiEnvelope<Subscription>) => r.data,
      providesTags: (_r, _e, farmId) => [{ type: "Subscription", id: farmId }],
    }),
  }),
});

export const { useGetSubscriptionQuery } = subscriptionApi;
