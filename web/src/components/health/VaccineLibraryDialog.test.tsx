import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { VaccineLibraryDialog } from "./VaccineLibraryDialog";

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
      if (input.url.includes("/catalog/vaccines") && input.method === "POST") {
        lastBody = await input.clone().json();
        return ok({ key: "newcastle-fermier", label: "Newcastle fermier", custom: true });
      }
      return ok([], 200);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("VaccineLibraryDialog", () => {
  it("creates a custom vaccine with slugified key and essential fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <VaccineLibraryDialog open onClose={vi.fn()} farmId={1} existingKeys={[]} />,
    );
    await user.type(screen.getByLabelText(/nom/i), "Newcastle fermier");
    await user.type(screen.getByLabelText(/maladie/i), "newcastle");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));

    await vi.waitFor(() => expect(lastBody).not.toBeNull());
    expect(lastBody).toEqual({
      key: "newcastle-fermier",
      value: { label: "Newcastle fermier", disease: "newcastle" },
    });
  });

  it("rejects a duplicate key on create", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <VaccineLibraryDialog open onClose={vi.fn()} farmId={1} existingKeys={["newcastle-fermier"]} />,
    );
    await user.type(screen.getByLabelText(/nom/i), "Newcastle fermier");
    await user.click(screen.getByRole("button", { name: /enregistrer/i }));
    expect(await screen.findByText(/existe déjà/i)).toBeInTheDocument();
    expect(lastBody).toBeNull();
  });
});
