import { baseApi } from "./baseApi";
import type { Client, ClientCreditInfo, ClientInput } from "@/types";

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/clients`;

/**
 * Per-farm client directory (Sprint B5-6). CRUD + soft-delete (DELETE) + the
 * indicative over-limit listing and per-client credit standing (Décision D26).
 */
export const clientsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getClients: build.query<Client[], { farmId: number }>({
      query: ({ farmId }) => base(farmId),
      transformResponse: (r: ApiEnvelope<Client[]>) => r.data,
      providesTags: [{ type: "Client", id: "list" }],
    }),
    getClientsOverCreditLimit: build.query<Client[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/over-credit-limit`,
      transformResponse: (r: ApiEnvelope<Client[]>) => r.data,
      providesTags: [{ type: "Client", id: "over-limit" }],
    }),
    getClient: build.query<Client, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<Client>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: "Client", id }],
    }),
    getClientCredit: build.query<ClientCreditInfo, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}/credit`,
      transformResponse: (r: ApiEnvelope<ClientCreditInfo>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: "Client", id: `credit-${id}` }],
    }),
    createClient: build.mutation<Client, { farmId: number; body: ClientInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: "POST", body }),
      transformResponse: (r: ApiEnvelope<Client>) => r.data,
      invalidatesTags: [
        { type: "Client", id: "list" },
        { type: "Client", id: "over-limit" },
      ],
    }),
    updateClient: build.mutation<Client, { farmId: number; id: number; body: ClientInput }>({
      query: ({ farmId, id, body }) => ({
        url: `${base(farmId)}/${id}`,
        method: "PUT",
        body,
      }),
      transformResponse: (r: ApiEnvelope<Client>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Client", id },
        { type: "Client", id: `credit-${id}` },
        { type: "Client", id: "list" },
        { type: "Client", id: "over-limit" },
      ],
    }),
    deactivateClient: build.mutation<void, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: "Client", id },
        { type: "Client", id: "list" },
        { type: "Client", id: "over-limit" },
      ],
    }),
  }),
});

export const {
  useGetClientsQuery,
  useGetClientsOverCreditLimitQuery,
  useGetClientQuery,
  useGetClientCreditQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeactivateClientMutation,
} = clientsApi;
