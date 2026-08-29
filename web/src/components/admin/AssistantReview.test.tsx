import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { AssistantReview } from "./AssistantReview";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/assistant",
}));

const TURN = {
  id: 1,
  farmId: 8,
  userId: 5,
  kind: "ANSWER",
  action: null,
  text: "combien de poulets me reste-t-il",
  summary: "1 240 sujets sur 3 lots",
  createdAt: "2026-08-29T18:00:00",
};

interface Call {
  url: string;
  method: string;
}

function mockApi(enabled = true, turns: unknown[] = [TURN]) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    // fetchBaseQuery hands fetch a Request, not (url, init).
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const url = request ? request.url : String(input);
      calls.push({ url, method: request ? request.method : (init?.method ?? "GET") });
      const payload = url.includes("/assistant/stats")
        ? { ANSWER: 40, DRAFT: 12 }
        : url.includes("/assistant/farms")
          ? { enabled }
          : turns;
      return new Response(JSON.stringify({ data: payload }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  adminTokenStorage.clear();
});

describe("AssistantReview", () => {
  it("shows the question and the answer, not just a count", async () => {
    mockApi();
    renderWithProviders(<AssistantReview />);

    // The failure mode is a confident wrong answer; only reading the text catches it.
    expect(await screen.findByText("combien de poulets me reste-t-il")).toBeInTheDocument();
    expect(screen.getByText("1 240 sujets sur 3 lots")).toBeInTheDocument();
  });

  it("translates the interaction kinds", async () => {
    mockApi();
    renderWithProviders(<AssistantReview />);

    // "Réponse" legitimately appears twice — once as a counter, once as a row's chip.
    expect(await screen.findAllByText("Réponse")).toHaveLength(2);
    expect(screen.getByText("Brouillon d'action")).toBeInTheDocument();
  });

  it("does not ask for a farm status before a farm is chosen", async () => {
    const calls = mockApi();
    renderWithProviders(<AssistantReview />);
    await screen.findByText("combien de poulets me reste-t-il");

    expect(calls.some((c) => c.url.includes("/assistant/farms/"))).toBe(false);
  });

  it("offers to switch the assistant off for a chosen farm", async () => {
    const calls = mockApi(true);
    renderWithProviders(<AssistantReview />);

    await userEvent.type(screen.getByLabelText(/Filtrer par ferme/), "8");
    await userEvent.click(screen.getByRole("button", { name: /filtrer/i }));

    await userEvent.click(await screen.findByRole("button", { name: /désactiver/i }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")!.url).toContain("/farms/8/disable");
  });

  it("says what a disabled farm actually sees", async () => {
    mockApi(false);
    renderWithProviders(<AssistantReview />);

    await userEvent.type(screen.getByLabelText(/Filtrer par ferme/), "8");
    await userEvent.click(screen.getByRole("button", { name: /filtrer/i }));

    // Switching a feature off silently is how support tickets are born.
    expect(await screen.findByText(/contacter le support/i)).toBeInTheDocument();
  });

  it("ignores a filter that is not a farm id", async () => {
    const calls = mockApi();
    renderWithProviders(<AssistantReview />);

    await userEvent.type(screen.getByLabelText(/Filtrer par ferme/), "abc");
    await userEvent.click(screen.getByRole("button", { name: /filtrer/i }));

    // NaN in the URL would return every farm's turns while looking filtered.
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("farmId=NaN"))).toBe(false),
    );
  });
});
