import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore } from "@/store/store";
import { setTokens } from "@/store/slices/authSlice";
import { useFarmPermissions } from "./useFarmPermissions";

function makeJwt(payload: unknown): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `h.${b64}.s`;
}

function wrapperWithToken(token: string | null) {
  const store = makeStore();
  if (token) store.dispatch(setTokens({ accessToken: token, refreshToken: "r", expiresIn: 3600 }));
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

describe("useFarmPermissions", () => {
  it("grants permissions from the membership of the given farm", () => {
    const token = makeJwt({
      memberships: [{ farmId: 3, farmRole: "FARMER", permissions: ["poultry:read", "health:read"] }],
    });
    const { result } = renderHook(() => useFarmPermissions(3), { wrapper: wrapperWithToken(token) });
    expect(result.current.can("poultry:read")).toBe(true);
    expect(result.current.can("inventory:read")).toBe(false);
  });

  it("denies everything when there is no membership for the farm", () => {
    const token = makeJwt({ memberships: [{ farmId: 99, farmRole: "OWNER", permissions: ["*"] }] });
    const { result } = renderHook(() => useFarmPermissions(3), { wrapper: wrapperWithToken(token) });
    expect(result.current.can("poultry:read")).toBe(false);
  });

  it("denies everything with no token", () => {
    const { result } = renderHook(() => useFarmPermissions(3), { wrapper: wrapperWithToken(null) });
    expect(result.current.can("poultry:read")).toBe(false);
  });
});
