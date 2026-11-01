import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { ArticleDialog } from "./ArticleDialog";

let lastBody: Record<string, unknown> | null = null;
let lastMethod = "";
let lastUrl = "";

beforeEach(() => {
  lastBody = null;
  lastMethod = "";
  lastUrl = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      lastMethod = input instanceof Request ? input.method : (init?.method ?? "GET");
      lastUrl = input instanceof Request ? input.url : String(input);
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

  /**
   * ADR-020: a medication bought into stock must also reach the treatment form, which reads the
   * health library. Declaring it as a medication therefore goes through the bridge route and
   * carries the withdrawal delays — the field that protects the farmer's sale dates and the one
   * the stock-only form could never ask for.
   */
  it("declares a medication through the bridge route, with its withdrawal delays", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ArticleDialog open onClose={vi.fn()} farmId={22} />);

    await user.type(screen.getByLabelText("Libellé"), "Hepaturyl");
    await user.click(screen.getByRole("combobox", { name: "Sous-catégorie" }));
    await user.click(await screen.findByRole("option", { name: "Médicament" }));
    await user.type(screen.getByLabelText("Unité"), "L");
    await user.type(screen.getByLabelText("Prix moyen (XOF)"), "4500");
    await user.type(screen.getByLabelText("Délai viande (jours)"), "7");
    await user.type(screen.getByLabelText("Délai œufs (jours)"), "3");

    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => expect(lastMethod).toBe("POST"));
    expect(lastUrl).toContain("/farms/22/inventory/catalog/medications");
    expect(lastBody).toEqual({
      key: "hepaturyl",
      label: "Hepaturyl",
      unit: "L",
      typicalUnitPriceXof: 4500,
      routes: [],
      withdrawalDaysMeat: 7,
      withdrawalDaysEggs: 3,
    });
  });

  it("asks for no withdrawal delay on an ordinary article", async () => {
    renderWithProviders(<ArticleDialog open onClose={vi.fn()} farmId={1} />);

    expect(screen.queryByLabelText("Délai viande (jours)")).not.toBeInTheDocument();
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
