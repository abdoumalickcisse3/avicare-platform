import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { partnerApi } from "./partnerApi";
import { partnerTokenStorage } from "@/lib/partnerStorage";

function called(arg: unknown): { url: string; method: string } {
  if (arg instanceof Request) return { url: arg.url, method: arg.method };
  if (typeof arg === "string") return { url: arg, method: "GET" };
  return { url: String(arg), method: "GET" };
}

function mockFetchOnce(body: unknown) {
  const m = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", m);
  return m;
}

describe("partnerApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    partnerTokenStorage.clear();
  });

  it("dashboard hits /api/v1/partner/network with the partner token", async () => {
    partnerTokenStorage.set("ptoken", "pref");
    const m = mockFetchOnce({
      data: { farmCount: 0, activeFarmCount: 0, totalFeedKg: null, avgMortalityRate: null },
    });
    const store = makeStore();
    await store.dispatch(partnerApi.endpoints.getNetworkDashboard.initiate());
    expect(called(m.mock.calls[0]?.[0]).url).toContain("/api/v1/partner/network");
  });

  it("login posts to /partner/auth/login and unwraps tokens", async () => {
    const m = mockFetchOnce({ data: { accessToken: "a", refreshToken: "r", expiresIn: 900 } });
    const store = makeStore();
    const res = await store.dispatch(
      partnerApi.endpoints.partnerLogin.initiate({ email: "p@x.io", password: "secret" }),
    );
    const c = called(m.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/partner/auth/login");
    expect(c.method).toBe("POST");
    expect((res as { data?: { accessToken: string } }).data?.accessToken).toBe("a");
  });
});
