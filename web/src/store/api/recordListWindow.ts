import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { listWindowServed } from "../slices/listWindowSlice";

type ApiBaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

interface WindowMeta {
  truncated: boolean;
  total: number;
  size: number;
}

const asWindowMeta = (body: unknown): WindowMeta | null => {
  if (typeof body !== "object" || body === null) return null;
  const meta = (body as { meta?: unknown }).meta;
  if (typeof meta !== "object" || meta === null) return null;
  const { truncated, total, size } = meta as Partial<WindowMeta>;
  return typeof truncated === "boolean" && typeof total === "number" && typeof size === "number"
    ? { truncated, total, size }
    : null;
};

/**
 * Reads the window the backend served (`meta.truncated` / `meta.total`) off the raw envelope and
 * records it, before `transformResponse` unwraps it and the numbers are gone. Only `@Windowed`
 * endpoints send those fields; every other response passes through untouched.
 */
export const recordListWindow =
  (baseQuery: ApiBaseQuery): ApiBaseQuery =>
  async (args, api, extraOptions) => {
    const result = await baseQuery(args, api, extraOptions);
    const meta = api.type === "query" ? asWindowMeta(result.data) : null;
    if (meta) {
      api.dispatch(listWindowServed({ endpoint: api.endpoint, ...meta }));
    }
    return result;
  };
