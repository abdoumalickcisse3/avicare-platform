/**
 * Assistant interpret endpoint — the hybrid fallback: when the on-device rules
 * parser can't understand a phrase and the device is online, the mobile sends
 * the text (never audio) to the backend `assistant` context, which runs the LLM
 * + a deterministic dry-run and returns a DRAFT to confirm or a CLARIFICATION.
 */
import { baseApi } from './baseApi';

export interface InterpretResponse {
  kind: 'DRAFT' | 'CLARIFICATION';
  action?: string | null;
  unitId?: number | null;
  fields?: Record<string, unknown> | null;
  summary?: string | null;
  message?: string | null;
}

interface ApiEnvelope<T> {
  data: T;
}

export const assistantApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    interpret: build.mutation<InterpretResponse, { farmId: number; text: string; unitId?: number | null }>({
      query: ({ farmId, text, unitId }) => ({
        url: `/api/v1/farms/${farmId}/assistant/interpret`,
        method: 'POST',
        body: { text, unitId: unitId ?? null },
      }),
      transformResponse: (r: ApiEnvelope<InterpretResponse>) => r.data,
    }),
  }),
});

export const { useInterpretMutation } = assistantApi;
