import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { makeStore } from "@/store/store";
import { catalogApi } from "./catalogApi";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}
let lastUrl = "";
beforeEach(() => {
  lastUrl = "";
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    lastUrl = input instanceof Request ? input.url : String(input);
    return respond([{ category: "breeds", key: "cobb_500", value: { label: "Cobb 500" }, custom: false }]);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("catalogApi.getCatalog", () => {
  it("unwraps the data envelope and hits the category URL", async () => {
    const store = makeStore();
    const res = await store.dispatch(
      catalogApi.endpoints.getCatalog.initiate({ farmId: 1, category: "breeds" }),
    );
    expect(res.data).toEqual([
      { category: "breeds", key: "cobb_500", value: { label: "Cobb 500" }, custom: false },
    ]);
    expect(lastUrl).toContain("/api/v1/farms/1/catalog/breeds");
  });
});
