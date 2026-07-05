import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { MyAdvancesDialog } from "./MyAdvancesDialog";
import type { Advance } from "@/types";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}

const ADVANCES: Advance[] = [
  {
    id: 1,
    userId: 7,
    amountXof: 15000,
    reason: "Avance ordinaire",
    status: "APPROVED",
    requestedAt: "2026-06-15T08:00:00Z",
    remainingXof: 5000,
  },
];

let postBody: Record<string, unknown> | null = null;

beforeEach(() => {
  postBody = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = input instanceof Request ? input.method : (init?.method ?? "GET");
      // /my/advances and /finance/ must be matched before the generic /api/v1/farms shape.
      if (url.includes("/my/advances")) {
        if (method === "POST") {
          if (input instanceof Request) {
            try {
              postBody = await input.clone().json();
            } catch {
              /* no body */
            }
          } else if (init?.body) {
            postBody = JSON.parse(init.body as string);
          }
          const created: Advance = {
            id: 2,
            userId: 7,
            amountXof: 10000,
            reason: "Frais imprévus",
            status: "PENDING",
            requestedAt: "2026-07-05T08:00:00Z",
            remainingXof: 10000,
          };
          return respond(created);
        }
        return respond(ADVANCES);
      }
      if (url.includes("/finance/")) {
        return respond(ADVANCES);
      }
      if (url.includes("/api/v1/farms")) {
        return respond([{ id: 1, name: "Ferme Test" }]);
      }
      return respond([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("MyAdvancesDialog", () => {
  it("posts a request with the exact payload", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MyAdvancesDialog open onClose={vi.fn()} />);

    await user.type(screen.getByLabelText("Montant (XOF)"), "10000");
    await user.type(screen.getByLabelText("Motif (optionnel)"), "Frais imprévus");
    await user.click(screen.getByRole("button", { name: /Demander/i }));

    await waitFor(() => expect(postBody).not.toBeNull());
    expect(postBody).toEqual({ farmId: 1, amountXof: 10000, reason: "Frais imprévus" });
  });

  it("renders the requester's advance history with its status", async () => {
    renderWithProviders(<MyAdvancesDialog open onClose={vi.fn()} />);

    expect(await screen.findByText("Approuvée")).toBeInTheDocument();
    expect(screen.getByText(/Restant/)).toBeInTheDocument();
  });
});
