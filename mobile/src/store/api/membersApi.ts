/**
 * Farm team members — ported from `web/src/store/api/membersApi.ts` (same
 * backend `GET /api/v1/farms/{id}/users`). Mobile keeps the read side: the
 * Fermes › Équipe tab lists members with their role and status. Member
 * provisioning (create/edit/reset-password/remove) is a security-sensitive
 * flow that stays on the web for now.
 */
import { baseApi } from './baseApi';
import type { Member } from '@/types';

interface ApiEnvelope<T> {
  data: T;
}

export const membersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMembers: build.query<Member[], number>({
      query: (farmId) => `/api/v1/farms/${farmId}/users`,
      transformResponse: (r: ApiEnvelope<Member[]>) => r.data,
      providesTags: (_r, _e, farmId) => [{ type: 'Member', id: `LIST-${farmId}` }],
    }),
  }),
});

export const { useGetMembersQuery } = membersApi;
