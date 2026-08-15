import { baseApi } from "./baseApi";

interface ApiEnvelope<T> {
  data: T;
}

/** One turn of the advisor thread, as sent to the backend (oldest first). */
export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export type AssistantKind = "DRAFT" | "ANSWER" | "CLARIFICATION";
export type Risk = "LOW" | "MEDIUM" | "HIGH";

/**
 * The assistant's reply (shared shape for chat + interpret): an ANSWER (advice
 * text in {@code message}), a DRAFT to confirm ({@code action} + {@code fields}
 * + {@code summary} + {@code claimId} + {@code risk}), or a CLARIFICATION.
 */
export interface AssistantResponse {
  kind: AssistantKind;
  action: string | null;
  unitId: number | null;
  fields: Record<string, unknown> | null;
  summary: string | null;
  message: string | null;
  risk: Risk | null;
  claimId: string | null;
}

export interface ConfirmResult {
  action: string;
  summary: string;
}

const base = (farmId: number) => `/api/v1/farms/${farmId}/assistant`;

/**
 * Jawdi advisor client. {@code chat} replays the whole thread and returns the
 * adviser's reply; {@code confirmAction} executes a stored DRAFT claim
 * server-side. A confirmed write can touch several domains, so it invalidates a
 * broad set of tags to refresh whatever view is open.
 */
export const assistantApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    chat: build.mutation<
      AssistantResponse,
      { farmId: number; messages: ChatTurn[]; unitId?: number | null }
    >({
      query: ({ farmId, messages, unitId }) => ({
        url: `${base(farmId)}/chat`,
        method: "POST",
        body: { messages, unitId: unitId ?? null },
      }),
      transformResponse: (r: ApiEnvelope<AssistantResponse>) => r.data,
    }),
    confirmAction: build.mutation<ConfirmResult, { farmId: number; claimId: string }>({
      query: ({ farmId, claimId }) => ({
        url: `${base(farmId)}/confirm`,
        method: "POST",
        body: { claimId },
      }),
      transformResponse: (r: ApiEnvelope<ConfirmResult>) => r.data,
      invalidatesTags: [
        { type: "PoultryBatch", id: "list" },
        { type: "DailyRecord", id: "list" },
        { type: "StockItem", id: "list" },
        { type: "StockMovement", id: "list" },
        { type: "Payment", id: "list" },
        { type: "Invoice", id: "list" },
        { type: "Vaccination", id: "list" },
        { type: "Dashboard", id: "summary" },
      ],
    }),
  }),
});

export const { useChatMutation, useConfirmActionMutation } = assistantApi;
