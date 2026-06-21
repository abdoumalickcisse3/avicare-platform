import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { paymentsApi } from "./paymentsApi";

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

describe("paymentsApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("getPayments filters by invoiceId", async () => {
    const m = mockFetchOnce({ data: [] });
    const store = makeStore();
    await store.dispatch(paymentsApi.endpoints.getPayments.initiate({ farmId: 7, invoiceId: 50 }));
    expect(called(m.mock.calls[0]?.[0]).url).toContain(
      "/api/v1/farms/7/commercial/payments?invoiceId=50",
    );
  });

  it("recordPayment POSTs to the collection", async () => {
    const m = mockFetchOnce({ data: { id: 1 } });
    const store = makeStore();
    await store.dispatch(
      paymentsApi.endpoints.recordPayment.initiate({
        farmId: 7,
        body: { invoiceId: 50, amountXof: 10000, method: "CASH" },
      }),
    );
    const c = called(m.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/farms/7/commercial/payments");
    expect(c.method).toBe("POST");
  });

  it("voidPayment POSTs to /{id}/void", async () => {
    const m = mockFetchOnce({ data: { id: 3 } });
    const store = makeStore();
    await store.dispatch(paymentsApi.endpoints.voidPayment.initiate({ farmId: 7, id: 3 }));
    const c = called(m.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/farms/7/commercial/payments/3/void");
    expect(c.method).toBe("POST");
  });
});
