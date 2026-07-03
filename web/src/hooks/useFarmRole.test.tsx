import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { makeStore } from "@/store/store";
import { setTokens } from "@/store/slices/authSlice";
import { useFarmRole, canManageCatalog } from "./useFarmRole";

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

describe("useFarmRole", () => {
  it("returns the farm role from the membership", () => {
    const token = makeJwt({ memberships: [{ farmId: 3, farmRole: "MANAGER", permissions: [] }] });
    const { result } = renderHook(() => useFarmRole(3), { wrapper: wrapperWithToken(token) });
    expect(result.current).toBe("MANAGER");
  });
  it("returns null when there is no membership / no token", () => {
    const { result } = renderHook(() => useFarmRole(3), { wrapper: wrapperWithToken(null) });
    expect(result.current).toBeNull();
  });
});

describe("canManageCatalog", () => {
  it("allows OWNER and MANAGER only", () => {
    expect(canManageCatalog("OWNER")).toBe(true);
    expect(canManageCatalog("MANAGER")).toBe(true);
    expect(canManageCatalog("FARMER")).toBe(false);
    expect(canManageCatalog(null)).toBe(false);
  });
});
