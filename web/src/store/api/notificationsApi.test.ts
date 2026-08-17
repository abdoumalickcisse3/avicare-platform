import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { notificationsApi } from "./notificationsApi";

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

describe("notificationsApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("getUnreadCount unwraps the envelope to a number", async () => {
    mockFetchOnce({ data: { count: 3 } });
    const store = makeStore();
    const res = await store.dispatch(
      notificationsApi.endpoints.getUnreadCount.initiate({ farmId: 7 }),
    );
    expect(res.data).toBe(3);
  });

  it("getNotifications requests the paged feed with unread flag", async () => {
    const m = mockFetchOnce({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    const store = makeStore();
    await store.dispatch(
      notificationsApi.endpoints.getNotifications.initiate({ farmId: 7, unread: true }),
    );
    expect(called(m.mock.calls[0]?.[0]).url).toContain(
      "/api/v1/farms/7/notifications?unread=true",
    );
  });

  it("markAllNotificationsRead POSTs to read-all", async () => {
    const m = mockFetchOnce({ data: null });
    const store = makeStore();
    await store.dispatch(
      notificationsApi.endpoints.markAllNotificationsRead.initiate({ farmId: 7 }),
    );
    const c = called(m.mock.calls[0]?.[0]);
    expect(c.url).toContain("/api/v1/farms/7/notifications/read-all");
    expect(c.method).toBe("POST");
  });
});
