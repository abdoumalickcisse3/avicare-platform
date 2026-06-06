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

/** Short human message preferring `detail` then `title`. */
export function apiErrorMessage(error: unknown): string {
  const parsed = parseApiError(error);
  return parsed.detail ?? parsed.title;
}
