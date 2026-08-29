import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { CompliancePanel } from "./CompliancePanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/conformite",
}));

const READY = {
  farmId: 8,
  farmName: "Ferme de Rosya",
  deletedAt: "2026-07-20T10:00:00",
  daysSinceDeletion: 40,
  lastExportAt: "2026-08-28T10:00:00",
  exportDone: true,
  retentionElapsed: true,
  purgeable: true,
  counts: { sales: 47, clients: 3 },
};
const NOT_READY = { ...READY, farmId: 9, farmName: "Ferme de Fatima", daysSinceDeletion: 3, exportDone: false, retentionElapsed: false, purgeable: false };

interface Call {
  url: string;
  method: string;
  body?: string;
}

function mockApi(farms: unknown[] = [READY]) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    // fetchBaseQuery hands fetch a Request, not (url, init).
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const url = request ? request.url : String(input);
      calls.push({
        url,
        method: request ? request.method : (init?.method ?? "GET"),
        body: request ? await request.clone().text() : (init?.body as string | undefined),
      });
      const payload = url.includes("/farms/deleted") ? farms : { farmId: 8, sections: ["livestock"] };
      return new Response(JSON.stringify({ data: payload }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

async function openPurge(name: string) {
  const row = (await screen.findByText(name)).closest("tr") as HTMLElement;
  await userEvent.click(within(row).getByRole("button", { name: /purger/i }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  adminTokenStorage.clear();
});

describe("CompliancePanel", () => {
  it("shows what a purge would destroy", async () => {
    mockApi();
    renderWithProviders(<CompliancePanel />);
    await openPurge("Ferme de Rosya");

    // The operator must see the scale of the erasure before confirming it.
    expect(await screen.findByText("47 sales")).toBeInTheDocument();
    expect(screen.getByText("3 clients")).toBeInTheDocument();
  });

  it("keeps the purge button disabled until the exact name is typed", async () => {
    mockApi();
    renderWithProviders(<CompliancePanel />);
    await openPurge("Ferme de Rosya");

    const confirm = await screen.findByRole("button", { name: /purger définitivement/i });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/nom exact/i), "Ferme de Rosy");
    expect(confirm).toBeDisabled();

    // A checkbox is clicked by reflex; a name has to be read first.
    await userEvent.type(screen.getByLabelText(/nom exact/i), "a");
    expect(confirm).toBeEnabled();
  });

  it("stays disabled when the server conditions are not met, whatever is typed", async () => {
    mockApi([NOT_READY]);
    renderWithProviders(<CompliancePanel />);
    await openPurge("Ferme de Fatima");

    await userEvent.type(await screen.findByLabelText(/nom exact/i), "Ferme de Fatima");

    expect(screen.getByRole("button", { name: /purger définitivement/i })).toBeDisabled();
    expect(screen.getByText(/Export effectué depuis la suppression/)).toBeInTheDocument();
  });

  it("sends the typed name so the server can check it too", async () => {
    const calls = mockApi();
    renderWithProviders(<CompliancePanel />);
    await openPurge("Ferme de Rosya");

    await userEvent.type(await screen.findByLabelText(/nom exact/i), "Ferme de Rosya");
    await userEvent.click(screen.getByRole("button", { name: /purger définitivement/i }));

    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
    const del = calls.find((c) => c.method === "DELETE")!;
    // Nothing in the UI is the gate; the server re-checks every condition.
    expect(JSON.parse(del.body as string)).toEqual({ confirmationName: "Ferme de Rosya" });
  });

  it("says why an account is anonymised rather than deleted", async () => {
    mockApi();
    renderWithProviders(<CompliancePanel />);

    expect(await screen.findByText(/59 colonnes du schéma le référencent/)).toBeInTheDocument();
  });
});
