/**
 * Broiler batches — ported from `web/src/store/api/poultryBatchesApi.ts`
 * (same backend, same endpoints). Only the reads the mobile Élevage screens
 * need for now: list + single batch. Entry mutations already go through the
 * offline sync queue, not this slice.
 */
import { baseApi } from './baseApi';
import type { BatchStatus, GrowthPerformance, PoultryBatch, PoultryDailyRecord, WeighingSample } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/poultry-batches`;

export interface CreateBatchInput {
  breedId: number;
  name?: string;
  startDate?: string;
  initialCount: number;
}

export const poultryBatchesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createBatch: build.mutation<PoultryBatch, { farmId: number; body: CreateBatchInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<PoultryBatch>) => r.data,
      invalidatesTags: [
        { type: 'PoultryBatch', id: 'LIST' },
        { type: 'ProductionUnit', id: 'LIST' },
      ],
    }),
    getBatches: build.query<PoultryBatch[], { farmId: number; status?: BatchStatus }>({
      query: ({ farmId, status }) => (status ? `${base(farmId)}?status=${status}` : base(farmId)),
      transformResponse: (r: ApiEnvelope<PoultryBatch[]>) => r.data,
      providesTags: [{ type: 'PoultryBatch', id: 'LIST' }],
    }),
    getBatch: build.query<PoultryBatch, { farmId: number; batchId: number }>({
      query: ({ farmId, batchId }) => `${base(farmId)}/${batchId}`,
      transformResponse: (r: ApiEnvelope<PoultryBatch>) => r.data,
      providesTags: (_r, _e, { batchId }) => [{ type: 'PoultryBatch', id: batchId }],
    }),
    getPerformance: build.query<GrowthPerformance, { farmId: number; batchId: number }>({
      query: ({ farmId, batchId }) => `${base(farmId)}/${batchId}/performance`,
      transformResponse: (r: ApiEnvelope<GrowthPerformance>) => r.data,
      providesTags: (_r, _e, { batchId }) => [{ type: 'Performance', id: batchId }],
    }),
    getWeighings: build.query<WeighingSample[], { farmId: number; batchId: number }>({
      query: ({ farmId, batchId }) => `${base(farmId)}/${batchId}/weighings`,
      transformResponse: (r: ApiEnvelope<WeighingSample[]>) => r.data,
      providesTags: (_r, _e, { batchId }) => [{ type: 'Weighing', id: batchId }],
    }),
    getDailyRecords: build.query<PoultryDailyRecord[], { farmId: number; batchId: number }>({
      query: ({ farmId, batchId }) => `${base(farmId)}/${batchId}/daily-records`,
      transformResponse: (r: ApiEnvelope<PoultryDailyRecord[]>) => r.data,
      providesTags: (_r, _e, { batchId }) => [{ type: 'DailyRecord', id: batchId }],
    }),
  }),
});

export const {
  useCreateBatchMutation,
  useGetBatchesQuery,
  useGetBatchQuery,
  useGetPerformanceQuery,
  useGetWeighingsQuery,
  useGetDailyRecordsQuery,
} = poultryBatchesApi;
