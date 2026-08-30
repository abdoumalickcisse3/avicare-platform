/**
 * RFC 7807 Problem Details as returned by the backend (doc 06 §1). Used to turn
 * an RTK Query error into a user-facing message.
 */
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code?: string;
  traceId?: string;
}

export function parseApiError(error: unknown): ApiError {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "title" in data) {
      return data as ApiError;
    }
  }
  return { type: "unknown", title: "Une erreur est survenue", status: 500 };
}

/**
 * The short reference a user can read out over the phone — the first block of the correlation id
 * the backend already puts in every error response. Short on purpose: it has to survive being
 * dictated on a bad line, and the console search matches on a prefix.
 */
export function apiErrorReference(error: unknown): string | null {
  const traceId = parseApiError(error).traceId;
  return traceId ? traceId.split("-")[0].toUpperCase() : null;
}

/**
 * Short human message preferring `detail` then `title`.
 *
 * <p>A server-side failure also carries its reference: those are the errors nobody can act on
 * alone, and the identifier is what turns "it broke this morning" into a request found in
 * /console/traces. A 4xx is the user's own business (a missing field, a refused transition) and
 * stays clean — an incident number there would only be noise.
 */
export function apiErrorMessage(error: unknown): string {
  const parsed = parseApiError(error);
  const message = parsed.detail ?? parsed.title;
  const reference = parsed.status >= 500 ? apiErrorReference(error) : null;
  return reference ? `${message} (réf. ${reference})` : message;
}
