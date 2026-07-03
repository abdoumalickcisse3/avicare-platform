import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { CatalogEntryDialog } from "./CatalogEntryDialog";
import { getCategoryConfig } from "@/constants/catalogCategories";

const LOTS = getCategoryConfig("lots")!;

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
    return respond({ category: "breeds", key: "x", value: {}, custom: true });
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
      category: "breeds",
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
});
