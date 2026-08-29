import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { adminTokenStorage } from "@/lib/adminStorage";
import { CatalogEditor } from "./CatalogEditor";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/console/catalogue",
}));

const CATEGORIES = [
  { category: "breeds", total: 5, active: 5, editable: true },
  { category: "modules", total: 16, active: 16, editable: false },
];
const ITEMS = [
  {
    id: 1,
    category: "breeds",
    key: "cobb_500",
    locale: null,
    label: "Cobb 500",
    value: { label: "Cobb 500", type: "broiler", species: "poultry" },
    active: true,
    editable: true,
    updatedAt: null,
  },
];

interface Call {
  url: string;
  method: string;
  body?: string;
}

function mockApi(items: unknown[] = ITEMS) {
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
      const payload = url.includes("/catalog/categories")
        ? CATEGORIES
        : url.includes("/admin/catalog")
          ? items
          : { userId: 1, email: "me@jawdi.app", permissions: ["*"], superAdmin: true };
      return new Response(JSON.stringify({ data: payload }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

async function openBreeds() {
  const row = (await screen.findByText("Races et souches")).closest("tr") as HTMLElement;
  await userEvent.click(within(row).getByRole("button", { name: /ouvrir/i }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  adminTokenStorage.clear();
});

describe("CatalogEditor", () => {
  it("marks the platform categories as read-only", async () => {
    mockApi();
    renderWithProviders(<CatalogEditor />);

    const row = (await screen.findByText("Modules (plateforme)")).closest("tr") as HTMLElement;
    // modules decides what a farm can reach — visible, not editable.
    expect(within(row).getByText("lecture seule")).toBeInTheDocument();
  });

  it("hides the create button on a read-only category", async () => {
    mockApi([]);
    renderWithProviders(<CatalogEditor />);

    const row = (await screen.findByText("Modules (plateforme)")).closest("tr") as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: /ouvrir/i }));

    expect(await screen.findByText(/se modifie par un déploiement relu/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nouvelle entrée/i })).not.toBeInTheDocument();
  });

  it("splits the label out of the JSON and folds it back on save", async () => {
    const calls = mockApi();
    renderWithProviders(<CatalogEditor />);
    await openBreeds();

    await userEvent.click(await screen.findByRole("button", { name: /modifier/i }));

    // The label has its own field, so the JSON box must not repeat it.
    const detail = screen.getByLabelText(/Détail \(JSON\)/) as HTMLTextAreaElement;
    expect(JSON.parse(detail.value)).toEqual({ type: "broiler", species: "poultry" });

    await userEvent.clear(screen.getByLabelText("Libellé"));
    await userEvent.type(screen.getByLabelText("Libellé"), "Cobb 500 Plus");
    await userEvent.click(screen.getByRole("button", { name: /enregistrer/i }));

    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT")!;
    expect(JSON.parse(put.body as string).value).toEqual({
      type: "broiler",
      species: "poultry",
      label: "Cobb 500 Plus",
    });
  });

  it("blocks saving while the JSON is malformed", async () => {
    const calls = mockApi();
    renderWithProviders(<CatalogEditor />);
    await openBreeds();
    await userEvent.click(await screen.findByRole("button", { name: /modifier/i }));

    const detail = screen.getByLabelText(/Détail \(JSON\)/);
    await userEvent.clear(detail);
    // userEvent reads { and [ as key descriptors, hence the doubling.
    await userEvent.type(detail, '{{"type": ');

    // Storing this would corrupt the entry; the server would take it as a valid map otherwise.
    expect(screen.getByRole("button", { name: /enregistrer/i })).toBeDisabled();
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("refuses a JSON array, which would parse but break every read site", async () => {
    mockApi();
    renderWithProviders(<CatalogEditor />);
    await openBreeds();
    await userEvent.click(await screen.findByRole("button", { name: /modifier/i }));

    const detail = screen.getByLabelText(/Détail \(JSON\)/);
    await userEvent.clear(detail);
    await userEvent.type(detail, "[[1, 2]");

    expect(screen.getByText(/objet JSON, entre accolades/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enregistrer/i })).toBeDisabled();
  });

  it("says that entries are deactivated, never deleted", async () => {
    mockApi();
    renderWithProviders(<CatalogEditor />);
    await openBreeds();
    await userEvent.click(await screen.findByRole("button", { name: /modifier/i }));

    // No foreign key protects these references; the rule has to be visible where it applies.
    expect(screen.getByText(/ne se supprime pas/)).toBeInTheDocument();
  });
});
