/**
 * Farm team members — ported from `web/src/store/api/membersApi.ts`.
 *
 * The roster now includes revoked members (backend fix in this lot): removing someone only flips
 * `active`, and a list that hid those rows made the removal irreversible. `getMembers` therefore
 * returns both, and the screens show a member's state instead of pretending they are gone.
 *
 * Every mutation here needs OWNER or MANAGER. The backend answers 422 OWNER_NOT_ASSIGNABLE if a
 * role of OWNER is submitted, which is why `AssignableFarmRole` excludes it at the type level.
 */
import { baseApi } from './baseApi';
import type { CreateMemberInput, CreateMemberResult, Member, UpdateMemberInput } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/users`;

/** Invalidating the roster and the JWT-backed session: a role change alters both. */
const rosterTags = (farmId: number) =>
  [
    { type: 'Member' as const, id: `LIST-${farmId}` },
    { type: 'User' as const, id: 'ME' },
  ] as const;

export const membersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMembers: build.query<Member[], number>({
      query: (farmId) => base(farmId),
      transformResponse: (r: ApiEnvelope<Member[]>) => r.data,
      providesTags: (_r, _e, farmId) => [{ type: 'Member', id: `LIST-${farmId}` }],
    }),

    createMember: build.mutation<CreateMemberResult, { farmId: number; body: CreateMemberInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<CreateMemberResult>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [...rosterTags(farmId)],
    }),

    updateMember: build.mutation<
      Member,
      { farmId: number; userId: number; body: UpdateMemberInput }
    >({
      query: ({ farmId, userId, body }) => ({
        url: `${base(farmId)}/${userId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (r: ApiEnvelope<Member>) => r.data,
      invalidatesTags: (_r, _e, { farmId }) => [...rosterTags(farmId)],
    }),

    /** Returns a one-time password. It is never retrievable again — show it before dismissing. */
    resetMemberPassword: build.mutation<
      { temporaryPassword: string },
      { farmId: number; userId: number }
    >({
      query: ({ farmId, userId }) => ({
        url: `${base(farmId)}/${userId}/reset-password`,
        method: 'POST',
      }),
      transformResponse: (r: ApiEnvelope<{ temporaryPassword: string }>) => r.data,
    }),

    /** Deactivates the membership rather than deleting it — reversible from the roster. */
    removeMember: build.mutation<void, { farmId: number; userId: number }>({
      query: ({ farmId, userId }) => ({ url: `${base(farmId)}/${userId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { farmId }) => [...rosterTags(farmId)],
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
