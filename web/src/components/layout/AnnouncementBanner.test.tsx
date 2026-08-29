import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { AnnouncementBanner } from "./AnnouncementBanner";

const ANNOUNCEMENT = {
  id: 4,
  title: "Maintenance samedi",
  body: "Le service sera interrompu de 8h à 10h.",
  severity: "WARNING" as const,
  startsAt: "2026-08-29T00:00:00",
  endsAt: null,
  published: true,
};

function mockApi(items: unknown[] = [ANNOUNCEMENT]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ data: items }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("AnnouncementBanner", () => {
  it("shows an active announcement", async () => {
    mockApi();
    renderWithProviders(<AnnouncementBanner />);

    expect(await screen.findByText("Maintenance samedi")).toBeInTheDocument();
  });

  it("renders nothing when there is nothing to say", async () => {
    mockApi([]);
    const { container } = renderWithProviders(<AnnouncementBanner />);

    // An empty banner still takes vertical space and pushes the page down.
    expect(container).toBeEmptyDOMElement();
  });

  it("stays dismissed across a remount", async () => {
    mockApi();
    const first = renderWithProviders(<AnnouncementBanner />);
    await userEvent.click(await screen.findByRole("button", { name: /close/i }));
    first.unmount();

    mockApi();
    renderWithProviders(<AnnouncementBanner />);

    expect(screen.queryByText("Maintenance samedi")).not.toBeInTheDocument();
  });

  it("ignores a corrupted dismissal list rather than blanking the banner", async () => {
    window.localStorage.setItem("jawdi.announcements.dismissed", "{ pas du json");
    mockApi();

    renderWithProviders(<AnnouncementBanner />);

    // A stored value nobody can parse must not hide a platform message.
    expect(await screen.findByText("Maintenance samedi")).toBeInTheDocument();
  });

  it("still closes when the browser refuses to remember it", async () => {
    mockApi();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    try {
      renderWithProviders(<AnnouncementBanner />);
      await userEvent.click(await screen.findByRole("button", { name: /close/i }));

      // A private window must not take the app down over a dismissal preference; the banner
      // simply comes back on the next load.
      expect(screen.queryByText("Maintenance samedi")).not.toBeInTheDocument();
    } finally {
      setItem.mockRestore();
    }
  });
});
