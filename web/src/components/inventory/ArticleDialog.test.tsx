import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ArticleDialog } from "./ArticleDialog";

let lastBody: Record<string, unknown> | null = null;
let lastMethod = "";

beforeEach(() => {
  lastBody = null;
  lastMethod = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      lastMethod = input instanceof Request ? input.method : (init?.method ?? "GET");
      if (input instanceof Request) {
        try {
          lastBody = await input.clone().json();
        } catch {
          /* no body */
        }
      } else if (init?.body) {
        lastBody = JSON.parse(init.body as string);
      }
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("ArticleDialog", () => {
  it("creates a custom article with a slugified key and the exact value payload", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ArticleDialog open onClose={vi.fn()} farmId={1} />);

    await user.type(screen.getByLabelText("Libellé"), "Mélange Maison");
    await user.click(screen.getByRole("combobox", { name: "Sous-catégorie" }));
    await user.click(await screen.findByRole("option", { name: "Aliment" }));
    await user.type(screen.getByLabelText("Unité"), "sac");
    await user.type(screen.getByLabelText("Prix moyen (XOF)"), "6000");

    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastBody).toEqual({
      key: "melange-maison",
      value: {
        label: "Mélange Maison",
        subcategory: "FEED",
        unit: "sac",
        typical_unit_price_xof: 6000,
      },
    });
  });

  it("rejects creating an article whose slugified key already exists", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ArticleDialog open onClose={vi.fn()} farmId={1} existingKeys={["melange-maison"]} />,
    );

    await user.type(screen.getByLabelText("Libellé"), "Mélange Maison");
    await user.click(screen.getByRole("combobox", { name: "Sous-catégorie" }));
    await user.click(await screen.findByRole("option", { name: "Aliment" }));

    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    expect(await screen.findByText("Un article avec ce nom existe déjà")).toBeInTheDocument();
    expect(lastMethod).toBe("");
    expect(lastBody).toBeNull();
  });
});
