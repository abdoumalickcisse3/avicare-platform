import { baseApi } from "./baseApi";
import type { CreateMemberInput, CreateMemberResult, FarmRole, Member } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

export const membersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMembers: build.query<Member[], number>({
      query: (farmId) => `/api/v1/farms/${farmId}/users`,
      transformResponse: (r: ApiEnvelope<Member[]>) => r.data,
      providesTags: (_r, _e, farmId) => [{ type: "Member", id: `LIST-${farmId}` }],
    }),
    createMember: build.mutation<
      CreateMemberResult,
      { farmId: number; body: CreateMemberInput }
    >({
      query: ({ farmId, body }) => ({
        url: `/api/v1/farms/${farmId}/users`,
        method: "POST",
        body,
      }),
      transformResponse: (r: ApiEnvelope<CreateMemberResult>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [{ type: "Member", id: `LIST-${farmId}` }],
    }),
    updateMember: build.mutation<
      Member,
      { farmId: number; userId: number; role: FarmRole; permissions?: string[]; active?: boolean }
    >({
      query: ({ farmId, userId, role, permissions, active }) => ({
        url: `/api/v1/farms/${farmId}/users/${userId}`,
        method: "PUT",
        body: { role, permissions, active },
      }),
      transformResponse: (r: ApiEnvelope<Member>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [{ type: "Member", id: `LIST-${farmId}` }],
    }),
    resetMemberPassword: build.mutation<
      { temporaryPassword: string },
      { farmId: number; userId: number }
    >({
      query: ({ farmId, userId }) => ({
        url: `/api/v1/farms/${farmId}/users/${userId}/reset-password`,
        method: "POST",
      }),
      transformResponse: (r: ApiEnvelope<{ temporaryPassword: string }>) => r.data,
    }),
    removeMember: build.mutation<void, { farmId: number; userId: number }>({
      query: ({ farmId, userId }) => ({
        url: `/api/v1/farms/${farmId}/users/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { farmId }) => [{ type: "Member", id: `LIST-${farmId}` }],
    }),
  }),
});

export const {
  useGetMembersQuery,
  useCreateMemberMutation,
  useUpdateMemberMutation,
  useResetMemberPasswordMutation,
  useRemoveMemberMutation,
} = membersApi;
