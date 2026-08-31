import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { IntegrityPanel } from "./IntegrityPanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/integrite",
}));

const RECOMPUTABLE = {
  id: 11,
  checkKey: "client_balance",
  label: "Encours client différent du reste dû",
  severity: "CRITICAL" as const,
  entityType: "client",
  entityId: 3,
  farmId: 24,
  expectedValue: "700000",
  actualValue: "999999",
  details: {},
  detectedAt: "2026-08-29T03:00:00",
  lastSeenAt: "2026-08-31T03:00:00",
  openForDays: 2,
  recomputable: true,
};

const NOT_RECOMPUTABLE = {
  ...RECOMPUTABLE,
  id: 12,
  checkKey: "order_total",
  label: "Total de commande différent de la somme des lignes",
  entityType: "order",
  entityId: 7,
  recomputable: false,
};

interface Call {
  url: string;
  method: string;
  body?: string;
}

function mockApi(findings: unknown[] = [RECOMPUTABLE]) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const url = request ? request.url : String(input);
      calls.push({
        url,
        method: request ? request.method : (init?.method ?? "GET"),
        body: request ? await request.clone().text() : (init?.body as string | undefined),
      });
      let payload: unknown = {
        critical: findings.length,
        warning: 0,
        info: 4,
        findings: { items: findings, page: 0, size: 50, totalElements: findings.length, totalPages: 1 },
      };
      if (url.includes("/preview")) {
        payload = {
          entityType: "client",
          entityId: 3,
          before: "999999",
          after: "700000",
          delta: "-299999",
          applied: false,
        };
      } else if (url.includes("/recompute")) {
        payload = { entityType: "client", entityId: 3, before: "999999", after: "700000", delta: "-299999", applied: true };
      }
      return new Response(JSON.stringify({ data: payload }), {
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

describe("IntegrityPanel", () => {
  it("puts the counters and the finding on screen", async () => {
    mockApi();
    renderWithProviders(<IntegrityPanel />);

    expect(await screen.findByText("Encours client différent du reste dû")).toBeInTheDocument();
    expect(screen.getByText("700000 ≠ 999999")).toBeInTheDocument();
    expect(screen.getByText("2 j")).toBeInTheDocument();
  });

  it("says so plainly when nothing is wrong", async () => {
    mockApi([]);
    renderWithProviders(<IntegrityPanel />);

    expect(await screen.findByText(/aucune anomalie ouverte/i)).toBeInTheDocument();
  });

  it("shows the dry run before offering to write anything", async () => {
    mockApi();
    renderWithProviders(<IntegrityPanel />);

    await userEvent.click(await screen.findByRole("button", { name: /recalculer/i }));

    expect(await screen.findByText(/Simulation : 999999 → 700000/)).toBeInTheDocument();
    // No reason typed yet, so nothing can be written.
    expect(screen.getByRole("button", { name: /confirmer/i })).toBeDisabled();
  });

  it("requires a written reason and sends it", async () => {
    const calls = mockApi();
    renderWithProviders(<IntegrityPanel />);

    await userEvent.click(await screen.findByRole("button", { name: /recalculer/i }));
    await screen.findByText(/Simulation/);
    await userEvent.type(screen.getByLabelText(/raison/i), "   ");
    expect(screen.getByRole("button", { name: /confirmer/i })).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/raison/i), "import raté");
    await userEvent.click(screen.getByRole("button", { name: /confirmer/i }));

    await waitFor(() => {
      const call = calls.find((c) => c.method === "POST" && c.url.includes("/recompute"));
      expect(call?.body).toContain("import raté");
    });
  });

  it("does not offer to overwrite a figure a human typed", async () => {
    mockApi([NOT_RECOMPUTABLE]);
    renderWithProviders(<IntegrityPanel />);

    const row = (await screen.findByText("order #7")).closest("tr") as HTMLElement;
    expect(within(row).queryByRole("button", { name: /recalculer/i })).toBeNull();
    // Closing it by hand stays possible — it is a business conversation, not an arithmetic one.
    expect(within(row).getByRole("button", { name: /accepter/i })).toBeInTheDocument();
  });

  it("runs the sweep on demand", async () => {
    const calls = mockApi();
    renderWithProviders(<IntegrityPanel />);

    await userEvent.click(await screen.findByRole("button", { name: /lancer maintenant/i }));

    await waitFor(() =>
      expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/integrity/run"))).toBe(true),
    );
  });
});
