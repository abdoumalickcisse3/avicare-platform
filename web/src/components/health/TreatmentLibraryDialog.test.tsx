import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { TreatmentLibraryDialog } from "./TreatmentLibraryDialog";

let lastBody: Record<string, unknown> | null = null;
function ok(data: unknown, status = 201) {
  return Promise.resolve(
    new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } }),
  );
}
beforeEach(() => {
  lastBody = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      if (input.url.includes("/catalog/treatments") && input.method === "POST") {
        lastBody = await input.clone().json();
        return ok({ key: "amox-locale", label: "Amox locale", custom: true });
      }
      return ok([], 200);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("TreatmentLibraryDialog", () => {
  it("creates a custom treatment with molecule + withdrawal days", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TreatmentLibraryDialog open onClose={vi.fn()} farmId={1} existingKeys={[]} />,
    );
    await user.type(screen.getByLabelText(/^nom/i), "Amox locale");
    await user.type(screen.getByLabelText(/molécule/i), "amoxicilline");
    await user.type(screen.getByLabelText(/délai viande/i), "7");
    await user.type(screen.getByLabelText(/délai œufs/i), "3");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    await vi.waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody).toEqual({
      key: "amox-locale",
      value: {
        label: "Amox locale",
        molecule: "amoxicilline",
        withdrawal_days_meat: 7,
        withdrawal_days_eggs: 3,
      },
    });
  });
});
