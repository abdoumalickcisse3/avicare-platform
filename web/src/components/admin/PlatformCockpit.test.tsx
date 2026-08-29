import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import type { PlatformRuntime } from "@/types";
import { PlatformCockpit } from "./PlatformCockpit";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/pilotage",
}));

const OVERVIEW = {
  farms: 14,
  activeFarms: 13,
  deletedFarms: 1,
  users: 18,
  activeUsers: 17,
  monthlyActiveUsers: 6,
  staffAccounts: 1,
  volumes: { productionUnits: 12, salesLast30d: 47 },
  generatedAt: "2026-08-29T18:00:00",
};
const USAGE = {
  days: 30,
  sent: 120,
  failed: 3,
  pending: 2,
  bySource: { ALERT: 100, INTERACTIVE: 20 },
  byFarm: {},
};
const FAILURE = {
  id: 5,
  maskedPhone: "••••6996",
  source: "ALERT",
  attempts: 3,
  lastError: "HTTP 402 credits exhausted",
  createdAt: "2026-08-29T17:00:00",
};

interface Call {
  url: string;
  method: string;
}

const DEFAULT_RUNTIME: PlatformRuntime = {
  schemaVersion: '47',
  appliedMigrations: 47,
  applicationVersion: null,
  serverTime: '2026-08-29T18:00:00',
  whatsappEnabled: true,
};

const FRESH_BACKUPS = {
  mounted: true,
  lastDumpAt: '2026-08-29T02:00:00',
  ageHours: 6,
  dumpCount: 14,
  totalBytes: 52428800,
  stale: false,
  offsiteConfigured: true,
};

function mockApi(runtime: PlatformRuntime | undefined = { schemaVersion: "45", appliedMigrations: 45, applicationVersion: null, serverTime: "2026-08-29T18:00:00", whatsappEnabled: true }, failures: unknown[] = [FAILURE], backups: unknown = FRESH_BACKUPS) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    // fetchBaseQuery hands fetch a Request, not (url, init).
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const url = request ? request.url : String(input);
      calls.push({ url, method: request ? request.method : (init?.method ?? "GET") });
      const resolvedRuntime = runtime ?? DEFAULT_RUNTIME;
      const payload = url.includes("/metrics/backups")
        ? backups
        : url.includes("/admin/benchmarks")
        ? { enabled: false, minCohort: 5, cohortSize: 3, available: false, platformMortalityRate: "—" }
        : url.includes("/whatsapp/failures")
        ? failures
        : url.includes("/metrics/whatsapp")
          ? USAGE
          : url.includes("/metrics/runtime")
            ? resolvedRuntime
            : OVERVIEW;
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

describe("PlatformCockpit", () => {
  it("shows the counters each context contributes", async () => {
    mockApi();
    renderWithProviders(<PlatformCockpit />);

    // The volumes map is open-ended: the screen renders what it is given, not a fixed list.
    expect(await screen.findByText("Lots et bâtiments")).toBeInTheDocument();
    expect(screen.getByText("Ventes (30 j)")).toBeInTheDocument();
  });

  it("falls back to the raw key for a counter it has no label for", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        const payload = url.includes("/metrics/overview")
          ? { ...OVERVIEW, volumes: { vaccinationsLast30d: 9 } }
          : url.includes("/whatsapp/failures")
            ? []
            : url.includes("/metrics/whatsapp")
              ? USAGE
              : { schemaVersion: "45", appliedMigrations: 45, applicationVersion: null, serverTime: "x", whatsappEnabled: true };
        return new Response(JSON.stringify({ data: payload }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    renderWithProviders(<PlatformCockpit />);

    // A context added later must show up untranslated rather than vanish from the cockpit.
    expect(await screen.findByText("vaccinationsLast30d")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("warns when WhatsApp sending is off", async () => {
    mockApi({ schemaVersion: "45", appliedMigrations: 45, applicationVersion: null, serverTime: "x", whatsappEnabled: false });
    renderWithProviders(<PlatformCockpit />);

    // Disabled sending is silent everywhere else: the reset screen still says "code sent".
    expect(
      await screen.findByText(/aucun message ne part, y compris les codes/i),
    ).toBeInTheDocument();
  });

  it("shows failures with the number masked", async () => {
    mockApi();
    renderWithProviders(<PlatformCockpit />);

    expect(await screen.findByText("••••6996")).toBeInTheDocument();
    expect(screen.getByText(/credits exhausted/)).toBeInTheDocument();
  });

  it("requeues a failed message", async () => {
    const calls = mockApi();
    renderWithProviders(<PlatformCockpit />);

    const row = (await screen.findByText("••••6996")).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: /réessayer/i }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")!.url).toContain("/whatsapp/5/retry");
  });

  it("asks the server again when the window changes", async () => {
    const calls = mockApi();
    renderWithProviders(<PlatformCockpit />);
    await screen.findByText("••••6996");

    await userEvent.click(screen.getByRole("button", { name: "7 j" }));

    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("/metrics/whatsapp?days=7"))).toBe(true),
    );
  });

  it("says the schema is unknown rather than showing nothing", async () => {
    mockApi({ schemaVersion: null, appliedMigrations: 0, applicationVersion: null, serverTime: "x", whatsappEnabled: true }, []);
    renderWithProviders(<PlatformCockpit />);

    expect(await screen.findByText("inconnu")).toBeInTheDocument();
  });

  it("offers the switch that publishes the comparison", async () => {
    const calls = mockApi();
    renderWithProviders(<PlatformCockpit />);

    // Without this the feature could not be turned on at all: the generic catalog editor keeps
    // the `admin` category read-only.
    const toggle = await screen.findByLabelText(/Publier la comparaison/);
    await userEvent.click(toggle);

    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    expect(calls.find((c) => c.method === "PUT")!.url).toContain("/admin/benchmarks");
  });

  it("says what publishing actually does before it is switched on", async () => {
    mockApi();
    renderWithProviders(<PlatformCockpit />);

    expect(
      await screen.findByText(/Aucune ferme n'est nommée/),
    ).toBeInTheDocument();
  });

  it("shows the age of the last backup", async () => {
    mockApi();
    renderWithProviders(<PlatformCockpit />);

    expect(await screen.findByText("il y a 6 h")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("raises an alarm when a nightly dump was missed", async () => {
    mockApi(undefined, [FAILURE], { ...FRESH_BACKUPS, ageHours: 40, stale: true });
    renderWithProviders(<PlatformCockpit />);

    // A backup that silently stopped is discovered on the day it is needed.
    expect(await screen.findByText(/Dernière sauvegarde il y a 40 h/)).toBeInTheDocument();
  });

  it("distinguishes an empty backup directory from an unmounted one", async () => {
    mockApi(undefined, [FAILURE], {
      ...FRESH_BACKUPS,
      dumpCount: 0,
      ageHours: null,
      stale: true,
    });
    renderWithProviders(<PlatformCockpit />);

    expect(await screen.findByText(/Aucune sauvegarde dans le répertoire/)).toBeInTheDocument();
  });

  it("does not claim backups are missing when it simply cannot see them", async () => {
    mockApi(undefined, [FAILURE], { ...FRESH_BACKUPS, mounted: false, stale: true });
    renderWithProviders(<PlatformCockpit />);

    // The dumps may well be running; a false alarm here would be worse than silence.
    expect(await screen.findByText(/ne peut simplement pas le vérifier/)).toBeInTheDocument();
    expect(screen.queryByText(/Aucune sauvegarde dans le répertoire/)).not.toBeInTheDocument();
  });
});
