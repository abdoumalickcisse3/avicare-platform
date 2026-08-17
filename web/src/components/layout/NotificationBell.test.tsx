import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { NotificationBell } from "./NotificationBell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function mockFetch(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
}

describe("NotificationBell", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the unread badge count from the API", async () => {
    mockFetch({ data: { count: 3 } });
    renderWithProviders(<NotificationBell farmId={7} />);
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("is disabled when no farm is selected", () => {
    mockFetch({ data: { count: 0 } });
    renderWithProviders(<NotificationBell farmId={undefined} />);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeDisabled();
  });
});
