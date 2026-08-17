import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { authApi } from "./authApi";

function called(arg: unknown, init?: RequestInit): { url: string; method: string } {
  if (arg instanceof Request) return { url: arg.url, method: arg.method };
  return { url: String(arg), method: init?.method ?? "GET" };
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

describe("authApi.updateProfile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("PUTs name + phone to /account/profile and unwraps the user", async () => {
    const m = mockFetchOnce({
      data: {
        id: 1,
        email: "u@test.io",
        fullName: "Awa",
        phone: "221770000000",
        locale: "fr",
        role: "USER",
      },
    });
    const store = makeStore();
    const res = await store.dispatch(
      authApi.endpoints.updateProfile.initiate({ fullName: "Awa", phone: "221770000000" }),
    );
    const c = called(m.mock.calls[0]?.[0], m.mock.calls[0]?.[1] as RequestInit);
    expect(c.url).toContain("/api/v1/account/profile");
    expect(c.method).toBe("PUT");
    expect((res.data as { phone: string })?.phone).toBe("221770000000");
  });
});
