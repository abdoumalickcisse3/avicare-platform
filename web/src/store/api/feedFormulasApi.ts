import { baseApi } from "./baseApi";
import type {
  AvailableFeedFormulas,
  CloneFormulaInput,
  FeedFormula,
  FeedFormulaInput,
} from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/inventory/feed-formulas`;

/**
 * Feed formulas (Sprint B4): the formulas a farm can use (platform templates +
 * its own), and CRUD on its own — create from scratch, clone a template, update,
 * recompute the cost snapshot, soft-delete.
 */
export const feedFormulasApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAvailableFormulas: build.query<AvailableFeedFormulas, { farmId: number }>({
      query: ({ farmId }) => base(farmId),
      transformResponse: (r: ApiEnvelope<AvailableFeedFormulas>) => r.data,
      providesTags: [{ type: "FeedFormula", id: "list" }],
    }),
    getFeedFormula: build.query<FeedFormula, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<FeedFormula>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: "FeedFormula", id }],
    }),
    createFeedFormula: build.mutation<
      FeedFormula,
      { farmId: number; body: FeedFormulaInput }
    >({
      query: ({ farmId, body }) => ({ url: base(farmId), method: "POST", body }),
      transformResponse: (r: ApiEnvelope<FeedFormula>) => r.data,
      invalidatesTags: [{ type: "FeedFormula", id: "list" }],
    }),
    cloneFeedFormula: build.mutation<
      FeedFormula,
      { farmId: number; body: CloneFormulaInput }
    >({
      query: ({ farmId, body }) => ({
        url: `${base(farmId)}/clone`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<FeedFormula>) => r.data,
      invalidatesTags: [{ type: "FeedFormula", id: "list" }],
    }),
    updateFeedFormula: build.mutation<
      FeedFormula,
      { farmId: number; id: number; body: FeedFormulaInput }
    >({
      query: ({ farmId, id, body }) => ({
        url: `${base(farmId)}/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (r: ApiEnvelope<FeedFormula>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "FeedFormula", id },
        { type: "FeedFormula", id: "list" },
      ],
    }),
    recomputeFormulaCost: build.mutation<
      FeedFormula,
      { farmId: number; id: number }
    >({
      query: ({ farmId, id }) => ({
        url: `${base(farmId)}/${id}/recompute-cost`,
        method: "POST",
      }),
      transformResponse: (r: ApiEnvelope<FeedFormula>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "FeedFormula", id },
        { type: "FeedFormula", id: "list" },
      ],
    }),
    deactivateFeedFormula: build.mutation<void, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({
        url: `${base(farmId)}/${id}/deactivate`,
        method: "POST",
      }),
      invalidatesTags: [{ type: "FeedFormula", id: "list" }],
    }),
  }),
});

export const {
  useGetAvailableFormulasQuery,
  useGetFeedFormulaQuery,
  useCreateFeedFormulaMutation,
  useCloneFeedFormulaMutation,
  useUpdateFeedFormulaMutation,
  useRecomputeFormulaCostMutation,
  useDeactivateFeedFormulaMutation,
} = feedFormulasApi;
