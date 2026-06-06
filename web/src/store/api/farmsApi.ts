import { baseApi } from "./baseApi";
import type { Farm, FarmInput } from "@/types";

/** Backend wraps every payload in { data, meta }; unwrap to the data field. */
interface ApiEnvelope<T> {
  data: T;
}

export const farmsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyFarms: build.query<Farm[], void>({
      query: () => "/api/v1/farms",
      transformResponse: (r: ApiEnvelope<Farm[]>) => r.data,
      providesTags: (result) =>
        result
          ? [
              ...result.map((f) => ({ type: "Farm" as const, id: f.id })),
              { type: "Farm" as const, id: "LIST" },
            ]
          : [{ type: "Farm" as const, id: "LIST" }],
    }),
    getFarm: build.query<Farm, number>({
      query: (id) => `/api/v1/farms/${id}`,
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      providesTags: (_r, _e, id) => [{ type: "Farm", id }],
    }),
    createFarm: build.mutation<Farm, FarmInput>({
      query: (body) => ({ url: "/api/v1/farms", method: "POST", body }),
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      invalidatesTags: [{ type: "Farm", id: "LIST" }],
    }),
    updateFarm: build.mutation<Farm, { id: number; body: FarmInput }>({
      query: ({ id, body }) => ({
        url: `/api/v1/farms/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (r: ApiEnvelope<Farm>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Farm", id },
        { type: "Farm", id: "LIST" },
      ],
    }),
    deleteFarm: build.mutation<void, number>({
      query: (id) => ({ url: `/api/v1/farms/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Farm", id: "LIST" }],
    }),
  }),
});

export const {
  useGetMyFarmsQuery,
  useGetFarmQuery,
  useCreateFarmMutation,
  useUpdateFarmMutation,
  useDeleteFarmMutation,
} = farmsApi;
