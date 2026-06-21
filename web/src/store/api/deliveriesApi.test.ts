import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { deliveriesApi } from "./deliveriesApi";

function called(arg: unknown): { url: string; method: string } {
  if (arg instanceof Request) return { url: arg.url, method: arg.method };
  if (typeof arg === "string") return { url: arg, method: "GET" };
  return { url: String(arg), method: "GET" };
}

function mockFetchOnce(body: unknown = { data: [] }) {
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

describe("deliveriesApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("getDeliveries hits the commercial deliveries path", async () => {
    const m = mockFetchOnce({ data: [] });
    const store = makeStore();
    await store.dispatch(deliveriesApi.endpoints.getDeliveries.initiate({ farmId: 7 }));
    expect(called(m.mock.calls[0]?.[0]).url).toContain("/api/v1/farms/7/commercial/deliveries");
  });

  it("createDeliveryFromOrder POSTs the order id", async () => {
    const m = mockFetchOnce({ data: { id: 1 } });
    const store = makeStore();
    await store.dispatch(
      deliveriesApi.endpoints.createDeliveryFromOrder.initiate({
        farmId: 7,
        body: { orderId: 11, carrier: "Moussa" },
      }),
    );
    const c = called(m.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/farms/7/commercial/deliveries");
    expect(c.method).toBe("POST");
  });

  it("cancelDelivery POSTs to /{id}/cancel", async () => {
    const m = mockFetchOnce({ data: { id: 3 } });
    const store = makeStore();
    await store.dispatch(deliveriesApi.endpoints.cancelDelivery.initiate({ farmId: 7, id: 3 }));
    const c = called(m.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/farms/7/commercial/deliveries/3/cancel");
    expect(c.method).toBe("POST");
  });
});
