/**
 * Commercial clients — ported from `web/src/store/api/clientsApi.ts` (same backend). Each client
 * is a running account: `currentBalanceXof` is what they owe.
 *
 * `PUT` is a REPLACEMENT. `ClientService.apply` reassigns every column from the command, so a
 * form that submits only the fields it displayed writes null over legal name, e-mail, address,
 * city, credit limit, payment terms and notes. This is the same shape as `PUT /farms/{id}` —
 * second occurrence of the pattern in this codebase. `ClientInput` therefore carries every
 * erasable field, and `getClient` exists so an editor can load the client whole first.
 *
 * Gated behind `module.commercial` on the backend (403 when inactive).
 */
import { baseApi } from './baseApi';
import type { Client, ClientCreditInfo, ClientType } from '@/types';

export interface ClientInput {
  clientType: ClientType;
  displayName: string;
  legalName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  creditLimitXof?: number | null;
  defaultPaymentTerms?: string | null;
  notes?: string | null;
}

interface ApiEnvelope<T> {
  data: T;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/commercial/clients`;

export const clientsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getClients: build.query<Client[], { farmId: number }>({
      query: ({ farmId }) => base(farmId),
      transformResponse: (r: ApiEnvelope<Client[]>) => r.data,
      providesTags: [{ type: 'Client', id: 'list' }],
    }),
    createClient: build.mutation<Client, { farmId: number; body: ClientInput }>({
      query: ({ farmId, body }) => ({ url: base(farmId), method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Client>) => r.data,
      invalidatesTags: [{ type: 'Client', id: 'list' }],
    }),
    getClient: build.query<Client, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}`,
      transformResponse: (r: ApiEnvelope<Client>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: 'Client', id }],
    }),

    /** Indicative credit standing (D26) — the backend never blocks a sale on it. */
    getClientCredit: build.query<ClientCreditInfo, { farmId: number; id: number }>({
      query: ({ farmId, id }) => `${base(farmId)}/${id}/credit`,
      transformResponse: (r: ApiEnvelope<ClientCreditInfo>) => r.data,
      providesTags: (_r, _e, { id }) => [{ type: 'Client', id: `credit-${id}` }],
    }),

    getClientsOverCreditLimit: build.query<Client[], { farmId: number }>({
      query: ({ farmId }) => `${base(farmId)}/over-credit-limit`,
      transformResponse: (r: ApiEnvelope<Client[]>) => r.data,
      providesTags: [{ type: 'Client', id: 'over-limit' }],
    }),

    updateClient: build.mutation<Client, { farmId: number; id: number; body: ClientInput }>({
      query: ({ farmId, id, body }) => ({ url: `${base(farmId)}/${id}`, method: 'PUT', body }),
      transformResponse: (r: ApiEnvelope<Client>) => r.data,
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Client', id },
        { type: 'Client', id: `credit-${id}` },
        { type: 'Client', id: 'list' },
        { type: 'Client', id: 'over-limit' },
      ],
    }),

    /** Soft: the client leaves the directory, their invoices and balance stay. */
    deactivateClient: build.mutation<void, { farmId: number; id: number }>({
      query: ({ farmId, id }) => ({ url: `${base(farmId)}/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Client', id },
        { type: 'Client', id: 'list' },
        { type: 'Client', id: 'over-limit' },
      ],
    }),
  }),
});

export const {
  useGetClientsQuery,
  useGetClientQuery,
  useGetClientCreditQuery,
  useGetClientsOverCreditLimitQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeactivateClientMutation,
} = clientsApi;
