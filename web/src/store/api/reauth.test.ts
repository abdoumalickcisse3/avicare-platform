import { describe, it, expect, vi } from "vitest";
import type { BaseQueryApi } from "@reduxjs/toolkit/query";
import { createReauthBaseQuery, isAuthEndpoint } from "./reauth";

const api = {} as BaseQueryApi;

function setup(rawImpl: (url: string, token: string | null) => unknown) {
  let access: string | null = "old";
  let refresh: string | null = "r-old";
  const refreshCalls: string[] = [];
  const onSessionLost = vi.fn();
  const rawBaseQuery = vi.fn(async (args: string | { url: string }) => {
    const url = typeof args === "string" ? args : args.url;
    if (url === "/refresh") {
      refreshCalls.push(refresh ?? "");
      await Promise.resolve();
      return rawImpl(url, access);
    }
    return rawImpl(url, access);
  });
  const query = createReauthBaseQuery({
    rawBaseQuery: rawBaseQuery as never,
    tokens: {
      getAccess: () => access,
      getRefresh: () => refresh,
      set: (a, r) => {
        access = a;
        refresh = r;
      },
    },
    refreshUrl: "/refresh",
    onSessionLost,
  });
  const replaceToken = (a: string, r: string) => {
    access = a;
    refresh = r;
  };
  return { query, refreshCalls, onSessionLost, rawBaseQuery, replaceToken };
}

const ok = { data: { ok: true } };
const unauthorized = { error: { status: 401, data: null } };

describe("createReauthBaseQuery", () => {
  it("sends ONE refresh when several requests hit a 401 together", async () => {
    const { query, refreshCalls, onSessionLost } = setup((url, token) => {
      if (url === "/refresh") return { data: { data: { accessToken: "new", refreshToken: "r-new" } } };
      return token === "new" ? ok : unauthorized;
    });

    const results = await Promise.all(
      ["/a", "/b", "/c", "/d"].map((u) => query(u, api, {})),
    );

    expect(refreshCalls).toHaveLength(1);
    expect(results.every((r) => r.data)).toBe(true);
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it("retries without refreshing when another request already replaced the token", async () => {
    let first = true;
    const ctx = setup((url, token) => {
      if (token === "new") return ok;
      if (first) {
        first = false;
        // The sibling request finishes its refresh while this one is still in flight.
        ctx.replaceToken("new", "r-new");
      }
      return unauthorized;
    });

    const result = await ctx.query("/a", api, {});

    expect(result.data).toBeDefined();
    expect(ctx.refreshCalls).toHaveLength(0);
  });

  it("ends the session when the refresh itself fails", async () => {
    const { query, onSessionLost } = setup(() => unauthorized);

    const result = await query("/a", api, {});

    expect(result.error?.status).toBe(401);
    expect(onSessionLost).toHaveBeenCalledTimes(1);
  });

  it("does not refresh or purge the session on a 401 from a login endpoint", async () => {
    const { query, refreshCalls, onSessionLost } = setup(() => unauthorized);

    const result = await query({ url: "/api/v1/auth/login", method: "POST" }, api, {});

    expect(result.error?.status).toBe(401);
    expect(refreshCalls).toHaveLength(0);
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it("recognises auth endpoints of every realm", () => {
    expect(isAuthEndpoint("/api/v1/auth/login")).toBe(true);
    expect(isAuthEndpoint({ url: "/api/v1/partner/auth/login" })).toBe(true);
    expect(isAuthEndpoint("/api/v1/farms")).toBe(false);
  });
});
