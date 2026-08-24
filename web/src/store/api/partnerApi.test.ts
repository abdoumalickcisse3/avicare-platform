import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { partnerApi } from "./partnerApi";
import { partnerTokenStorage } from "@/lib/partnerStorage";

interface Call {
  url: string;
  method: string;
  authorization: string | null;
}

/** Stub global fetch with a 200 envelope and record what RTK Query actually sent. */
function mockFetchOnce(body: unknown): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(
        input instanceof Request
          ? {
              url: input.url,
              method: input.method,
              authorization: input.headers.get("Authorization"),
            }
          : { url: String(input), method: "GET", authorization: null },
      );
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

describe("partnerApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    partnerTokenStorage.clear();
  });

  it("dashboard hits /api/v1/partner/network with the partner token", async () => {
    partnerTokenStorage.set("ptoken", "pref");
    const calls = mockFetchOnce({
      data: { farmCount: 0, activeFarmCount: 0, totalFeedKg: null, avgMortalityRate: null },
    });
    const store = makeStore();
    await store.dispatch(partnerApi.endpoints.getNetworkDashboard.initiate());

    expect(calls[0]?.url).toContain("/api/v1/partner/network");
    expect(calls[0]?.authorization).toBe("Bearer ptoken");
  });

  it("login posts to /partner/auth/login and unwraps tokens", async () => {
    const calls = mockFetchOnce({ data: { accessToken: "a", refreshToken: "r", expiresIn: 900 } });
    const store = makeStore();
    const res = await store.dispatch(
      partnerApi.endpoints.partnerLogin.initiate({ email: "p@x.io", password: "secret" }),
    );

    expect(calls[0]?.url).toContain("/api/v1/partner/auth/login");
    expect(calls[0]?.method).toBe("POST");
    expect((res as { data?: { accessToken: string } }).data?.accessToken).toBe("a");
  });
});
