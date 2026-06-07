import { baseApi } from "./baseApi";
import type {
  BatchStatus,
  CreateBatchInput,
  DailyRecordInput,
  GrowthPerformance,
  PoultryBatch,
  PoultryDailyRecord,
  WeighingInput,
  WeighingSample,
} from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/poultry-batches`;

export const poultryBatchesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBatches: build.query<
      PoultryBatch[],
      { farmId: number; status?: BatchStatus }
    >({
      query: ({ farmId, status }) =>
        status ? `${base(farmId)}?status=${status}` : base(farmId),
      transformResponse: (r: ApiEnvelope<PoultryBatch[]>) => r.data,
      providesTags: [{ type: "PoultryBatch", id: "LIST" }],
    }),
    getBatch: build.query<PoultryBatch, { farmId: number; batchId: number }>({
      query: ({ farmId, batchId }) => `${base(farmId)}/${batchId}`,
      transformResponse: (r: ApiEnvelope<PoultryBatch>) => r.data,
      providesTags: (_r, _e, { batchId }) => [
        { type: "PoultryBatch", id: batchId },
      ],
    }),
    createBatch: build.mutation<
      PoultryBatch,
      { farmId: number; body: CreateBatchInput }
    >({
      query: ({ farmId, body }) => ({ url: base(farmId), method: "POST", body }),
      transformResponse: (r: ApiEnvelope<PoultryBatch>) => r.data,
      invalidatesTags: [{ type: "PoultryBatch", id: "LIST" }],
    }),

    getDailyRecords: build.query<
      PoultryDailyRecord[],
      { farmId: number; batchId: number }
    >({
      query: ({ farmId, batchId }) => `${base(farmId)}/${batchId}/daily-records`,
      transformResponse: (r: ApiEnvelope<PoultryDailyRecord[]>) => r.data,
      providesTags: (_r, _e, { batchId }) => [
        { type: "DailyRecord", id: batchId },
      ],
    }),
    createDailyRecord: build.mutation<
      PoultryDailyRecord,
      { farmId: number; batchId: number; body: DailyRecordInput }
    >({
      query: ({ farmId, batchId, body }) => ({
        url: `${base(farmId)}/${batchId}/daily-records`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<PoultryDailyRecord>) => r.data,
      invalidatesTags: (_r, _e, { batchId }) => [
        { type: "DailyRecord", id: batchId },
        { type: "Performance", id: batchId },
        { type: "PoultryBatch", id: batchId },
      ],
    }),

    getWeighings: build.query<
      WeighingSample[],
      { farmId: number; batchId: number }
    >({
      query: ({ farmId, batchId }) => `${base(farmId)}/${batchId}/weighings`,
      transformResponse: (r: ApiEnvelope<WeighingSample[]>) => r.data,
      providesTags: (_r, _e, { batchId }) => [{ type: "Weighing", id: batchId }],
    }),
    createWeighing: build.mutation<
      WeighingSample,
      { farmId: number; batchId: number; body: WeighingInput }
    >({
      query: ({ farmId, batchId, body }) => ({
        url: `${base(farmId)}/${batchId}/weighings`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<WeighingSample>) => r.data,
      invalidatesTags: (_r, _e, { batchId }) => [
        { type: "Weighing", id: batchId },
        { type: "Performance", id: batchId },
      ],
    }),

    getPerformance: build.query<
      GrowthPerformance,
      { farmId: number; batchId: number }
    >({
      query: ({ farmId, batchId }) => `${base(farmId)}/${batchId}/performance`,
      transformResponse: (r: ApiEnvelope<GrowthPerformance>) => r.data,
      providesTags: (_r, _e, { batchId }) => [
        { type: "Performance", id: batchId },
      ],
    }),
  }),
});

export const {
  useGetBatchesQuery,
  useGetBatchQuery,
  useCreateBatchMutation,
  useGetDailyRecordsQuery,
  useCreateDailyRecordMutation,
  useGetWeighingsQuery,
  useCreateWeighingMutation,
  useGetPerformanceQuery,
} = poultryBatchesApi;
