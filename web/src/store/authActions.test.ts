import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "./store";
import { logout } from "./authActions";
import { setTokens } from "./slices/authSlice";
import { setSelectedFarmId } from "./slices/uiSlice";
import { farmsApi } from "./api/farmsApi";
import { tokenStorage } from "@/lib/storage";
import type { Farm } from "@/types";

const farmA = { id: 1, name: "Ferme A" } as Farm;

function mockFetch() {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // fetchBaseQuery hands fetch a Request, so the body is on it, not on `init`.
      const raw =
        input instanceof Request ? await input.clone().text() : ((init?.body as string) ?? "");
      calls.push({
        url: input instanceof Request ? input.url : String(input),
        body: raw ? JSON.parse(raw) : undefined,
      });
      return new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  tokenStorage.clear();
});

describe("logout", () => {
  it("wipes auth tokens, the selected farm and the RTK Query cache so the next account sees nothing", async () => {
    const store = makeStore();

    // Simulate an active session for account A: token, a selected farm, and a
    // cached query holding A's data. upsertQueryData is async — await it so the
    // cache is populated before we assert.
    store.dispatch(setTokens({ accessToken: "a-token", refreshToken: "a-refresh", expiresIn: 900 }));
    store.dispatch(setSelectedFarmId(1));
    await store.dispatch(farmsApi.util.upsertQueryData("getMyFarms", undefined, [farmA]));

    // Sanity: the cache really holds A's farm before logout.
    expect(farmsApi.endpoints.getMyFarms.select()(store.getState())?.data).toEqual([farmA]);

    mockFetch();
    await store.dispatch(logout());

    const state = store.getState();
    expect(state.auth.accessToken).toBeNull();
    expect(state.auth.refreshToken).toBeNull();
    expect(state.ui.selectedFarmId).toBeNull();
    // The RTK Query cache must be empty — no leftover query data from account A.
    expect(state.api.queries).toEqual({});
    expect(farmsApi.endpoints.getMyFarms.select()(store.getState())?.data).toBeUndefined();
  });

  it("revokes the refresh token server-side, not just in this browser", async () => {
    const store = makeStore();
    const calls = mockFetch();

    tokenStorage.set("a-token", "a-refresh");
    store.dispatch(setTokens({ accessToken: "a-token", refreshToken: "a-refresh", expiresIn: 900 }));

    await store.dispatch(logout());

    // Clearing the browser alone left the refresh token valid for its whole lifetime, so a copy
    // of it still bought a session long after the farmer thought they had left.
    const revoke = calls.find((c) => c.url.includes("/api/v1/auth/logout"));
    expect(revoke).toBeDefined();
    expect(revoke?.body).toEqual({ refreshToken: "a-refresh" });
  });

  it("still signs the user out locally when the revocation fails", async () => {
    const store = makeStore();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));

    tokenStorage.set("a-token", "a-refresh");
    store.dispatch(setTokens({ accessToken: "a-token", refreshToken: "a-refresh", expiresIn: 900 }));

    await store.dispatch(logout());

    expect(store.getState().auth.accessToken).toBeNull();
  });
});
