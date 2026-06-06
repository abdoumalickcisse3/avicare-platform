import { baseApi } from "./baseApi";
import type {
  ChangeRequest,
  FeatureMode,
  Subscription,
  SubscriptionModule,
} from "@/types";

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
    enableModule: build.mutation<
      SubscriptionModule,
      { farmId: number; moduleKey: string; mode?: FeatureMode }
    >({
      query: ({ farmId, moduleKey, mode = "HARD" }) => ({
        url: `/api/v1/farms/${farmId}/subscription/modules`,
        method: "POST",
        body: { moduleKey, mode, expiresAt: null },
      }),
      transformResponse: (r: ApiEnvelope<SubscriptionModule>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [
        { type: "Subscription", id: farmId },
      ],
    }),
    listChangeRequests: build.query<ChangeRequest[], number>({
      query: (farmId) =>
        `/api/v1/farms/${farmId}/subscription/change-requests`,
      transformResponse: (r: ApiEnvelope<ChangeRequest[]>) => r.data,
      providesTags: (_r, _e, farmId) => [
        { type: "Subscription", id: `CR-${farmId}` },
      ],
    }),
    createChangeRequest: build.mutation<
      ChangeRequest,
      { farmId: number; requestedPlan: string; requestedModules: string[] }
    >({
      query: ({ farmId, requestedPlan, requestedModules }) => ({
        url: `/api/v1/farms/${farmId}/subscription/change-requests`,
        method: "POST",
        body: { requestedPlan, requestedModules },
      }),
      transformResponse: (r: ApiEnvelope<ChangeRequest>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [
        { type: "Subscription", id: `CR-${farmId}` },
      ],
    }),
    submitChangeRequest: build.mutation<
      ChangeRequest,
      { farmId: number; requestId: number }
    >({
      query: ({ farmId, requestId }) => ({
        url: `/api/v1/farms/${farmId}/subscription/change-requests/${requestId}/submit`,
        method: "POST",
      }),
      transformResponse: (r: ApiEnvelope<ChangeRequest>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [
        { type: "Subscription", id: `CR-${farmId}` },
      ],
    }),
  }),
});

export const {
  useGetSubscriptionQuery,
  useEnableModuleMutation,
  useListChangeRequestsQuery,
  useCreateChangeRequestMutation,
  useSubmitChangeRequestMutation,
} = subscriptionApi;
