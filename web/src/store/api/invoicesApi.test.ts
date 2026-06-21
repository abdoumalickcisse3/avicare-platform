import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { invoicesApi } from "./invoicesApi";

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

describe("invoicesApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("getInvoices hits the commercial invoices path", async () => {
    const m = mockFetchOnce({ data: [] });
    const store = makeStore();
    await store.dispatch(invoicesApi.endpoints.getInvoices.initiate({ farmId: 7 }));
    expect(called(m.mock.calls[0]?.[0]).url).toContain("/api/v1/farms/7/commercial/invoices");
  });

  it("getOverdueInvoices hits /overdue", async () => {
    const m = mockFetchOnce({ data: [] });
    const store = makeStore();
    await store.dispatch(invoicesApi.endpoints.getOverdueInvoices.initiate({ farmId: 7 }));
    expect(called(m.mock.calls[0]?.[0]).url).toContain("/commercial/invoices/overdue");
  });

  it("createInvoiceFromSale POSTs to /from-sale", async () => {
    const m = mockFetchOnce({ data: { id: 1 } });
    const store = makeStore();
    await store.dispatch(
      invoicesApi.endpoints.createInvoiceFromSale.initiate({ farmId: 7, saleId: 20 }),
    );
    const c = called(m.mock.calls[0]?.[0]);
    expect(c.url).toContain("/commercial/invoices/from-sale");
    expect(c.method).toBe("POST");
  });

  it("createInvoiceFromDelivery POSTs to /from-delivery", async () => {
    const m = mockFetchOnce({ data: { id: 1 } });
    const store = makeStore();
    await store.dispatch(
      invoicesApi.endpoints.createInvoiceFromDelivery.initiate({ farmId: 7, deliveryId: 30 }),
    );
    expect(called(m.mock.calls[0]?.[0]).url).toContain("/commercial/invoices/from-delivery");
  });
});
