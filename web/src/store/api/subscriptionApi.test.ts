import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { subscriptionApi } from "./subscriptionApi";

/** fetchBaseQuery calls fetch with a Request; pull URL + method off it. */
function called(arg: unknown): { url: string; method: string } {
  if (arg instanceof Request) return { url: arg.url, method: arg.method };
  return { url: String(arg), method: "GET" };
}

function mockFetch() {
  const fetchMock = vi.fn(async (..._args: unknown[]) =>
    new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("subscriptionApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("getPlans hits the public plans endpoint", async () => {
    const fetchMock = mockFetch();
    const store = makeStore();
    await store.dispatch(subscriptionApi.endpoints.getPlans.initiate());
    expect(called(fetchMock.mock.calls[0]?.[0]).url).toContain(
      "/api/v1/subscription/plans",
    );
  });

  it("applyPlan posts the plan key to the farm subscription", async () => {
    const fetchMock = mockFetch();
    const store = makeStore();
    await store.dispatch(
      subscriptionApi.endpoints.applyPlan.initiate({ farmId: 7, planKey: "pro_volaille" }),
    );
    const { url, method } = called(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/api/v1/farms/7/subscription/plan");
    expect(method).toBe("POST");
  });
});
