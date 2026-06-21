import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { salesApi } from "./salesApi";

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

describe("salesApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("getSales hits the farm-scoped commercial sales path", async () => {
    const fetchMock = mockFetchOnce({ data: [] });
    const store = makeStore();
    await store.dispatch(salesApi.endpoints.getSales.initiate({ farmId: 7 }));
    expect(called(fetchMock.mock.calls[0]?.[0]).url).toContain(
      "/api/v1/farms/7/commercial/sales",
    );
  });

  it("getSales appends the status filter", async () => {
    const fetchMock = mockFetchOnce({ data: [] });
    const store = makeStore();
    await store.dispatch(salesApi.endpoints.getSales.initiate({ farmId: 7, status: "CANCELLED" }));
    expect(called(fetchMock.mock.calls[0]?.[0]).url).toContain("status=CANCELLED");
  });

  it("createSale POSTs to the collection", async () => {
    const fetchMock = mockFetchOnce({ data: { id: 1 } });
    const store = makeStore();
    await store.dispatch(
      salesApi.endpoints.createSale.initiate({
        farmId: 7,
        body: {
          clientId: null,
          paymentMethod: "CASH",
          lines: [
            { articleKey: "eggs_consumption", articleSource: "INVENTORY", quantity: 10, unitPriceXof: 3000 },
          ],
        },
      }),
    );
    const c = called(fetchMock.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/farms/7/commercial/sales");
    expect(c.method).toBe("POST");
  });

  it("cancelSale POSTs to /{id}/cancel", async () => {
    const fetchMock = mockFetchOnce({ data: { id: 3 } });
    const store = makeStore();
    await store.dispatch(salesApi.endpoints.cancelSale.initiate({ farmId: 7, id: 3, reason: "x" }));
    const c = called(fetchMock.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/farms/7/commercial/sales/3/cancel");
    expect(c.method).toBe("POST");
  });
});
