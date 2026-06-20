import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { clientsApi } from "./clientsApi";

/** fetchBaseQuery calls fetch with a Request; pull the URL/method off it. */
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

describe("clientsApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("getClients hits the farm-scoped commercial path", async () => {
    const fetchMock = mockFetchOnce({ data: [] });
    const store = makeStore();
    await store.dispatch(clientsApi.endpoints.getClients.initiate({ farmId: 7 }));
    expect(called(fetchMock.mock.calls[0]?.[0]).url).toContain(
      "/api/v1/farms/7/commercial/clients",
    );
  });

  it("getClientCredit hits the /credit sub-resource", async () => {
    const fetchMock = mockFetchOnce({ data: {} });
    const store = makeStore();
    await store.dispatch(
      clientsApi.endpoints.getClientCredit.initiate({ farmId: 7, id: 3 }),
    );
    expect(called(fetchMock.mock.calls[0]?.[0]).url).toContain(
      "/api/v1/farms/7/commercial/clients/3/credit",
    );
  });

  it("getClientsOverCreditLimit hits the over-credit-limit path", async () => {
    const fetchMock = mockFetchOnce({ data: [] });
    const store = makeStore();
    await store.dispatch(
      clientsApi.endpoints.getClientsOverCreditLimit.initiate({ farmId: 7 }),
    );
    expect(called(fetchMock.mock.calls[0]?.[0]).url).toContain(
      "/api/v1/farms/7/commercial/clients/over-credit-limit",
    );
  });

  it("createClient POSTs to the collection", async () => {
    const fetchMock = mockFetchOnce({ data: { id: 1 } });
    const store = makeStore();
    await store.dispatch(
      clientsApi.endpoints.createClient.initiate({
        farmId: 7,
        body: { clientType: "BUSINESS", displayName: "Ferme du Soleil" },
      }),
    );
    const c = called(fetchMock.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/farms/7/commercial/clients");
    expect(c.method).toBe("POST");
  });

  it("deactivateClient DELETEs the resource", async () => {
    const fetchMock = mockFetchOnce({ data: null });
    const store = makeStore();
    await store.dispatch(
      clientsApi.endpoints.deactivateClient.initiate({ farmId: 7, id: 3 }),
    );
    const c = called(fetchMock.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/farms/7/commercial/clients/3");
    expect(c.method).toBe("DELETE");
  });
});
