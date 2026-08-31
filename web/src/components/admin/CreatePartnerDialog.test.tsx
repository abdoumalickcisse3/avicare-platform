import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { CreatePartnerDialog } from "./CreatePartnerDialog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/partenaires",
}));

interface Call {
  url: string;
  method: string;
  body?: string;
}

function mockApi() {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      calls.push({
        url: request ? request.url : String(input),
        method: request ? request.method : (init?.method ?? "GET"),
        body: request ? await request.clone().text() : (init?.body as string | undefined),
      });
      return new Response(JSON.stringify({ data: { id: 7, name: "Sedima", type: "FEED_SUPPLIER" } }), {
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

describe("CreatePartnerDialog", () => {
  it("will not create an unnamed organisation", async () => {
    mockApi();
    renderWithProviders(<CreatePartnerDialog open onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: /créer/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/nom de l'organisation/i), "Sedima");
    expect(screen.getByRole("button", { name: /créer/i })).toBeEnabled();
  });

  it("sends the name and the type", async () => {
    const calls = mockApi();
    renderWithProviders(<CreatePartnerDialog open onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/nom de l'organisation/i), "Sedima");
    await userEvent.click(screen.getByRole("button", { name: /créer/i }));

    await waitFor(() => {
      const call = calls.find((c) => c.method === "POST");
      expect(call?.url).toContain("/admin/partners");
      expect(call?.body).toContain("Sedima");
      expect(call?.body).toContain("FEED_SUPPLIER");
    });
  });

  it("hands the new id back so the caller can open the file", async () => {
    mockApi();
    const onCreated = vi.fn();
    renderWithProviders(<CreatePartnerDialog open onClose={vi.fn()} onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText(/nom de l'organisation/i), "Sedima");
    await userEvent.click(screen.getByRole("button", { name: /créer/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(7));
  });

  it("leaves empty contact fields out of the payload", async () => {
    const calls = mockApi();
    renderWithProviders(<CreatePartnerDialog open onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/nom de l'organisation/i), "Avisen");
    await userEvent.click(screen.getByRole("button", { name: /créer/i }));

    await waitFor(() => {
      const call = calls.find((c) => c.method === "POST");
      // Sending "" would store an empty string where the absence of a value is the truth.
      expect(call?.body).not.toContain('"contactPhone"');
    });
  });
});
