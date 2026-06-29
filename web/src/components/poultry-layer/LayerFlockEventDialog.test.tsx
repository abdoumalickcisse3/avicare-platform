import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { LayerFlockEventDialog } from "./LayerFlockEventDialog";

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

let lastBody: Record<string, unknown> | null = null;

beforeEach(() => {
  lastBody = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (input instanceof Request) {
        try {
          lastBody = await input.clone().json();
        } catch {
          /* not JSON */
        }
      } else if (init?.body) {
        lastBody = JSON.parse(init.body as string);
      }
      if (url.includes("/mortality") || url.includes("/events")) {
        return respond({
          id: 9,
          productionUnitId: 1,
          eventType: "MORTALITY",
          quantityDelta: -2,
          reason: null,
          details: {},
          occurredAt: "2026-06-29T08:00:00",
        });
      }
      return respond([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("LayerFlockEventDialog", () => {
  it("bloque la soumission tant que la quantité est 0", async () => {
    renderWithProviders(
      <LayerFlockEventDialog
        open
        onClose={vi.fn()}
        farmId={1}
        unitId={1}
        mode="mortality"
        currentCount={100}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Enregistrer/i }),
    ).toBeDisabled();
  });

  it("envoie la mortalité avec le bon corps", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <LayerFlockEventDialog
        open
        onClose={onClose}
        farmId={1}
        unitId={1}
        mode="mortality"
        currentCount={100}
      />,
    );
    await user.type(screen.getByLabelText(/Nombre/i), "2");
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(lastBody).toEqual({ count: 2, reason: undefined });
  });

  it("envoie la réforme comme un événement REFORM à delta négatif", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LayerFlockEventDialog
        open
        onClose={vi.fn()}
        farmId={1}
        unitId={1}
        mode="reform"
        currentCount={100}
      />,
    );
    await user.type(screen.getByLabelText(/Nombre/i), "10");
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));
    await waitFor(() =>
      expect(lastBody).toEqual({
        eventType: "REFORM",
        quantityDelta: -10,
        reason: undefined,
      }),
    );
  });
});
