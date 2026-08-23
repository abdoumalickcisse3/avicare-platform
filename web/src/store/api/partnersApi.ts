import { baseApi } from "./baseApi";
import type { AvailablePartner, FarmPartner, PartnerType, SharingScopes } from "@/types";

interface Envelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/partners`;

/**
 * Farmer-facing partner network surface. Farm-scoped; reads need farm membership and writes are
 * OWNER/MANAGER-gated on the backend. Mutations invalidate the "mine" list so the enriched
 * (name/type) view re-fetches after a write.
 */
export const partnersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAvailablePartners: build.query<
      AvailablePartner[],
      { farmId: number; type?: PartnerType }
    >({
      query: ({ farmId, type }) => `${base(farmId)}/available${type ? `?type=${type}` : ""}`,
      transformResponse: (r: Envelope<AvailablePartner[]>) => r.data,
      providesTags: [{ type: "Partner", id: "directory" }],
    }),

    getMyPartners: build.query<FarmPartner[], { farmId: number }>({
      query: ({ farmId }) => base(farmId),
      transformResponse: (r: Envelope<FarmPartner[]>) => r.data,
      providesTags: [{ type: "Partner", id: "mine" }],
    }),

    declarePartner: build.mutation<FarmPartner, { farmId: number; partnerId: number }>({
      query: ({ farmId, partnerId }) => ({
        url: `${base(farmId)}/declare`,
        method: "POST",
        body: { partnerId },
      }),
      transformResponse: (r: Envelope<FarmPartner>) => r.data,
      invalidatesTags: [{ type: "Partner", id: "mine" }],
    }),

    joinNetwork: build.mutation<FarmPartner, { farmId: number; code: string }>({
      query: ({ farmId, code }) => ({
        url: `${base(farmId)}/join`,
        method: "POST",
        body: { code },
      }),
      transformResponse: (r: Envelope<FarmPartner>) => r.data,
      invalidatesTags: [{ type: "Partner", id: "mine" }],
    }),

    updateSharing: build.mutation<
      FarmPartner,
      { farmId: number; membershipId: number; scopes: SharingScopes }
    >({
      query: ({ farmId, membershipId, scopes }) => ({
        url: `${base(farmId)}/${membershipId}/scopes`,
        method: "PUT",
        body: scopes,
      }),
      transformResponse: (r: Envelope<FarmPartner>) => r.data,
      invalidatesTags: [{ type: "Partner", id: "mine" }],
    }),

    leaveNetwork: build.mutation<FarmPartner, { farmId: number; membershipId: number }>({
      query: ({ farmId, membershipId }) => ({
        url: `${base(farmId)}/${membershipId}`,
        method: "DELETE",
      }),
      transformResponse: (r: Envelope<FarmPartner>) => r.data,
      invalidatesTags: [{ type: "Partner", id: "mine" }],
    }),
  }),
});

export const {
  useGetAvailablePartnersQuery,
  useGetMyPartnersQuery,
  useDeclarePartnerMutation,
  useJoinNetworkMutation,
  useUpdateSharingMutation,
  useLeaveNetworkMutation,
} = partnersApi;
