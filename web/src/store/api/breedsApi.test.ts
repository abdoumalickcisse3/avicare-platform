import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStore } from "@/store/store";
import { breedsApi } from "./breedsApi";

/** fetchBaseQuery calls fetch with a Request; pull the URL off whatever it passed. */
function calledUrl(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Request) return arg.url;
  return String(arg);
}

function mockFetchOnce() {
  const fetchMock = vi.fn(async (..._args: unknown[]) =>
    new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("breedsApi.getBreeds", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("defaults the required species param to POULTRY", async () => {
    const fetchMock = mockFetchOnce();
    const store = makeStore();
    await store.dispatch(breedsApi.endpoints.getBreeds.initiate());
    expect(calledUrl(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/v1/breeds?species=POULTRY",
    );
  });

  it("uses the species passed explicitly", async () => {
    const fetchMock = mockFetchOnce();
    const store = makeStore();
    await store.dispatch(breedsApi.endpoints.getBreeds.initiate({ species: "OVINE" }));
    expect(calledUrl(fetchMock.mock.calls[0]?.[0])).toContain("species=OVINE");
  });
});
