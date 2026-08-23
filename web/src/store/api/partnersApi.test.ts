import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { partnersApi } from "./partnersApi";

function called(arg: unknown): { url: string; method: string } {
  if (arg instanceof Request) return { url: arg.url, method: arg.method };
  if (typeof arg === "string") return { url: arg, method: "GET" };
  return { url: String(arg), method: "GET" };
}

function mockFetchOnce(body: unknown) {
  const fetchMock = vi.fn(
    async (..._args: unknown[]) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("partnersApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("getMyPartners hits the farm-scoped partners path", async () => {
    const m = mockFetchOnce({ data: [] });
    const store = makeStore();
    await store.dispatch(partnersApi.endpoints.getMyPartners.initiate({ farmId: 42 }));
    expect(called(m.mock.calls[0]?.[0]).url).toContain("/api/v1/farms/42/partners");
  });

  it("getAvailablePartners passes the type filter", async () => {
    const m = mockFetchOnce({ data: [] });
    const store = makeStore();
    await store.dispatch(
      partnersApi.endpoints.getAvailablePartners.initiate({ farmId: 42, type: "VET" }),
    );
    expect(called(m.mock.calls[0]?.[0]).url).toContain(
      "/api/v1/farms/42/partners/available?type=VET",
    );
  });

  it("declarePartner POSTs to /declare", async () => {
    const m = mockFetchOnce({ data: {} });
    const store = makeStore();
    await store.dispatch(
      partnersApi.endpoints.declarePartner.initiate({ farmId: 42, partnerId: 3 }),
    );
    const c = called(m.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/farms/42/partners/declare");
    expect(c.method).toBe("POST");
  });

  it("leaveNetwork DELETEs the membership", async () => {
    const m = mockFetchOnce({ data: {} });
    const store = makeStore();
    await store.dispatch(
      partnersApi.endpoints.leaveNetwork.initiate({ farmId: 42, membershipId: 8 }),
    );
    const c = called(m.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/farms/42/partners/8");
    expect(c.method).toBe("DELETE");
  });
});
