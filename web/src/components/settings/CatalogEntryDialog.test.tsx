import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { CatalogEntryDialog } from "./CatalogEntryDialog";
import { getCategoryConfig, type CategoryConfig } from "@/constants/catalogCategories";

// Décor local plutôt qu'une vraie catégorie : ces tests portent sur le composant, pas sur le
// contenu du catalogue, et les attacher à une catégorie réelle les cassait dès qu'elle bougeait.
const LOTS: CategoryConfig = {
  slug: "essai",
  backendCategory: "essai_items",
  title: "Essai",
  description: "Décor de test.",
  labelField: "label",
  fields: [
    { name: "label", label: "Nom", type: "text", required: true },
    {
      name: "type",
      label: "Type",
      type: "select",
      required: true,
      options: [
        { value: "broiler", label: "Chair" },
        { value: "layer", label: "Ponte" },
      ],
    },
    { name: "species", label: "Espèce", type: "text", const: "poultry" },
  ],
};
const STOCK = getCategoryConfig("stock")!;

function respond(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
}
let lastBody: Record<string, unknown> | null = null;
beforeEach(() => {
  lastBody = null;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (input instanceof Request) {
      try { lastBody = await input.clone().json(); } catch { /* */ }
    }
    return respond({ category: "essai_items", key: "x", value: {}, custom: true });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("CatalogEntryDialog", () => {
  it("creates a custom entry: derives the key from the label and injects const fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CatalogEntryDialog open onClose={vi.fn()} config={LOTS} farmId={1} />,
    );
    await user.type(screen.getByLabelText("Nom"), "Cobb 500");
    // MUI select for "Type"
    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.click(await screen.findByRole("option", { name: "Chair" }));
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody).toMatchObject({
      key: "cobb-500",
      value: { label: "Cobb 500", type: "broiler", species: "poultry" },
    });
  });

  it("edits an existing entry: keeps the key and preserves unknown value fields", async () => {
    const user = userEvent.setup();
    const entry = {
      category: "essai_items",
      key: "ross_308",
      value: { label: "Ross 308", type: "broiler", species: "poultry", extra: "keepme" },
      custom: false,
    };
    renderWithProviders(
      <CatalogEntryDialog open onClose={vi.fn()} config={LOTS} farmId={1} entry={entry} />,
    );
    const nom = screen.getByLabelText("Nom");
    await user.clear(nom);
    await user.type(nom, "Ross 308 Plus");
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody).toMatchObject({
      key: "ross_308",
      value: { label: "Ross 308 Plus", type: "broiler", species: "poultry", extra: "keepme" },
    });
  });

  it("stores a number field as a number, not a string", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CatalogEntryDialog open onClose={vi.fn()} config={STOCK} farmId={1} />,
    );
    await user.type(screen.getByLabelText("Nom de l'article"), "Mais local");
    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.click(await screen.findByRole("option", { name: "Aliment" }));
    await user.type(screen.getByLabelText(/Unit\u00e9/), "kg");
    await user.type(screen.getByLabelText(/Prix indicatif/), "320");
    await user.click(screen.getByRole("button", { name: /Enregistrer/i }));

    await waitFor(() => expect(lastBody).not.toBeNull());
    const value = (lastBody as { value: Record<string, unknown> }).value;
    expect(value).toMatchObject({ label: "Mais local", subcategory: "FEED", unit: "kg" });
    // The crux: the price is a number, not the string "320".
    expect(value.typical_unit_price_xof).toBe(320);
  });

});
