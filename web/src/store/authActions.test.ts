import { describe, expect, it } from "vitest";
import { makeStore } from "./store";
import { logout } from "./authActions";
import { setTokens } from "./slices/authSlice";
import { setSelectedFarmId } from "./slices/uiSlice";
import { farmsApi } from "./api/farmsApi";
import type { Farm } from "@/types";

const farmA = { id: 1, name: "Ferme A" } as Farm;

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

    store.dispatch(logout());

    const state = store.getState();
    expect(state.auth.accessToken).toBeNull();
    expect(state.auth.refreshToken).toBeNull();
    expect(state.ui.selectedFarmId).toBeNull();
    // The RTK Query cache must be empty — no leftover query data from account A.
    expect(state.api.queries).toEqual({});
    expect(farmsApi.endpoints.getMyFarms.select()(store.getState())?.data).toBeUndefined();
  });
});
