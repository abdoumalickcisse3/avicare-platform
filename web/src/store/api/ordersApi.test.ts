import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { ordersApi } from "./ordersApi";

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

describe("ordersApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("getOrders hits the commercial orders path", async () => {
    const m = mockFetchOnce({ data: [] });
    const store = makeStore();
    await store.dispatch(ordersApi.endpoints.getOrders.initiate({ farmId: 7 }));
    expect(called(m.mock.calls[0]?.[0]).url).toContain("/api/v1/farms/7/commercial/orders");
  });

  it("getOrders encodes status + clientId filters", async () => {
    const m = mockFetchOnce({ data: [] });
    const store = makeStore();
    await store.dispatch(
      ordersApi.endpoints.getOrders.initiate({ farmId: 7, status: "PENDING", clientId: 3 }),
    );
    const url = called(m.mock.calls[0]?.[0]).url;
    expect(url).toContain("status=PENDING");
    expect(url).toContain("clientId=3");
  });

  it("confirmOrder POSTs to /{id}/confirm", async () => {
    const m = mockFetchOnce({ data: { id: 5 } });
    const store = makeStore();
    await store.dispatch(ordersApi.endpoints.confirmOrder.initiate({ farmId: 7, id: 5 }));
    const c = called(m.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/farms/7/commercial/orders/5/confirm");
    expect(c.method).toBe("POST");
  });

  it("startOrderPreparation POSTs to /{id}/start-preparation", async () => {
    const m = mockFetchOnce({ data: { id: 5 } });
    const store = makeStore();
    await store.dispatch(ordersApi.endpoints.startOrderPreparation.initiate({ farmId: 7, id: 5 }));
    expect(called(m.mock.calls[0]?.[0]).url).toContain("/start-preparation");
  });
});
