import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { TraceExplorer } from "./TraceExplorer";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/traces",
}));

const ROW = {
  id: 12,
  requestId: "3f2a91cc-1b7e-4a0d-9f11-2c4d5e6f7a8b",
  method: "POST",
  path: "/api/v1/farms/3/sales",
  statusCode: 500,
  durationMs: 812,
  userEmail: "eleveur@ferme.sn",
  farmId: 3,
  hasError: true,
  startedAt: "2026-08-30T10:37:00",
};

const DETAIL = {
  ...ROW,
  routePattern: "/api/v1/farms/{farmId}/sales",
  userId: 7,
  ip: "10.0.0.1",
  requestBody: '{"clientId":4,"password":"***"}',
  responseBody: '{"title":"Internal Server Error"}',
  errorMessage: "IllegalStateException: boom",
  stackTrace: "java.lang.IllegalStateException: boom\n\tat com.avicare...",
  endedAt: "2026-08-30T10:37:01",
  auditActions: ["staff.post /api/v1/farms/{farmId}/sales"],
};

function mockApi(items: unknown[] = [ROW]) {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      urls.push(url);
      const body = url.includes("/traces/")
        ? { data: DETAIL }
        : { items, page: 0, size: 50, totalElements: items.length, totalPages: 1 };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  adminTokenStorage.clear();
});

describe("TraceExplorer", () => {
  it("lists traces with the short reference the user reads out", async () => {
    mockApi();
    renderWithProviders(<TraceExplorer />);

    expect(await screen.findByText("3F2A91CC")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("812 ms")).toBeInTheDocument();
    expect(screen.getByText("eleveur@ferme.sn")).toBeInTheDocument();
  });

  it("searches on the identifier the caller was given", async () => {
    const urls = mockApi();
    renderWithProviders(<TraceExplorer />);
    await screen.findByText("3F2A91CC");

    await userEvent.type(screen.getByLabelText(/référence/i), "3f2a91cc");

    await waitFor(() =>
      expect(urls.some((u) => u.includes("requestId=3f2a91cc"))).toBe(true),
    );
  });

  it("narrows to failures on demand", async () => {
    const urls = mockApi();
    renderWithProviders(<TraceExplorer />);
    await screen.findByText("3F2A91CC");

    await userEvent.click(screen.getByLabelText(/erreurs seulement/i));

    await waitFor(() => expect(urls.some((u) => u.includes("errorsOnly=true"))).toBe(true));
  });

  it("opens a trace and shows its masked payload and stack trace", async () => {
    mockApi();
    renderWithProviders(<TraceExplorer />);

    await userEvent.click(await screen.findByText("3F2A91CC"));

    expect(await screen.findByText(/Trace #12/)).toBeInTheDocument();
    // The dialog title renders before the detail request resolves, so the payload is awaited.
    expect(await screen.findByText(/"password":"\*\*\*"/)).toBeInTheDocument();
    // Twice on purpose: the one-line message in the alert, and the stack trace below it.
    expect(screen.getAllByText(/IllegalStateException: boom/)).toHaveLength(2);
    expect(screen.getByText("staff.post /api/v1/farms/{farmId}/sales")).toBeInTheDocument();
  });

  it("says so plainly when nothing matches", async () => {
    mockApi([]);
    renderWithProviders(<TraceExplorer />);

    expect(await screen.findByText(/aucune trace/i)).toBeInTheDocument();
  });
});
