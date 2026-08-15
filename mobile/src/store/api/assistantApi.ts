/**
 * Assistant endpoints. `interpret` is the one-shot field fallback (text → a
 * DRAFT / CLARIFICATION / ANSWER). `chat` is the conversational advisor: the
 * whole thread is replayed and the backend answers, analyses, advises, or
 * prepares an action (DRAFT + claimId). `confirmAction` executes a stored DRAFT
 * claim server-side. Audio never leaves the device — only text.
 */
import { baseApi } from './baseApi';

export type AssistantKind = 'DRAFT' | 'CLARIFICATION' | 'ANSWER';
export type Risk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface InterpretResponse {
  kind: AssistantKind;
  action?: string | null;
  unitId?: number | null;
  fields?: Record<string, unknown> | null;
  summary?: string | null;
  message?: string | null;
  risk?: Risk | null;
  claimId?: string | null;
}

/** One turn of the advisor thread as sent to the backend. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ConfirmResult {
  action: string;
  summary: string;
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
    chat: build.mutation<
      InterpretResponse,
      { farmId: number; messages: ChatTurn[]; unitId?: number | null }
    >({
      query: ({ farmId, messages, unitId }) => ({
        url: `/api/v1/farms/${farmId}/assistant/chat`,
        method: 'POST',
        body: { messages, unitId: unitId ?? null },
      }),
      transformResponse: (r: ApiEnvelope<InterpretResponse>) => r.data,
    }),
    confirmAction: build.mutation<ConfirmResult, { farmId: number; claimId: string }>({
      query: ({ farmId, claimId }) => ({
        url: `/api/v1/farms/${farmId}/assistant/confirm`,
        method: 'POST',
        body: { claimId },
      }),
      transformResponse: (r: ApiEnvelope<ConfirmResult>) => r.data,
    }),
  }),
});

export const { useInterpretMutation, useChatMutation, useConfirmActionMutation } = assistantApi;
