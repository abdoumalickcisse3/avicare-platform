import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { TreatmentLibraryDialog } from "./TreatmentLibraryDialog";

let lastBody: Record<string, unknown> | null = null;
let lastUrl = "";
function ok(data: unknown, status = 201) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } }),
  );
}
beforeEach(() => {
  lastBody = null;
  lastUrl = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      if (input.method === "POST") {
        lastUrl = input.url;
        lastBody = await input.clone().json();
        return ok({
          key: "amox-locale",
          label: "Amox locale",
          routes: [],
          medicalSheetWritten: true,
        });
      }
      return ok([], 200);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("TreatmentLibraryDialog", () => {
  /**
   * ADR-020: a medication is one product. Adding it from Sanitaire must also give it the stock
   * article the farmer buys and decrements against — before the bridge, the two catalogs could
   * only be filled separately and farms ended up declaring the same bottle twice.
   */
  it("declares the medication on both faces, with its unit and indicative price", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TreatmentLibraryDialog open onClose={vi.fn()} farmId={22} existingKeys={[]} />,
    );
    await user.type(screen.getByLabelText(/^nom/i), "Amox locale");
    await user.type(screen.getByLabelText(/molécule/i), "amoxicilline");
    await user.type(screen.getByLabelText(/délai viande/i), "7");
    await user.type(screen.getByLabelText(/délai œufs/i), "3");
    await user.type(screen.getByLabelText(/^unité/i), "L");
    await user.type(screen.getByLabelText(/prix moyen/i), "4500");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    await vi.waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastUrl).toContain("/farms/22/inventory/catalog/medications");
    expect(lastBody).toEqual({
      key: "amox-locale",
      label: "Amox locale",
      molecule: "amoxicilline",
      routes: [],
      unit: "L",
      typicalUnitPriceXof: 4500,
      withdrawalDaysMeat: 7,
      withdrawalDaysEggs: 3,
    });
  });

  it("creates the medication with no stock detail when none is given", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TreatmentLibraryDialog open onClose={vi.fn()} farmId={1} existingKeys={[]} />,
    );
    await user.type(screen.getByLabelText(/^nom/i), "Amox locale");
    await user.type(screen.getByLabelText(/molécule/i), "amoxicilline");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    await vi.waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody).toEqual({
      key: "amox-locale",
      label: "Amox locale",
      molecule: "amoxicilline",
      routes: [],
    });
  });
});
