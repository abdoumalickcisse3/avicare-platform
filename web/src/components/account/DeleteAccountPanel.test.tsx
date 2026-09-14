import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import { DeleteAccountPanel } from "./DeleteAccountPanel";

/** Le serveur répond le compte de fermes possédées, puis accepte ou refuse la suppression. */
function mockApi({ ownedFarmCount = 0, deleteStatus = 204 } = {}) {
  const calls: { url: string; method: string; body?: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // RTK Query passe un objet `Request` : `String(input)` vaudrait « [object Request] » et
      // aucune URL ne serait reconnue — le simulacre répondrait la même chose à tout.
      const request = input instanceof Request ? input : null;
      const url = request ? request.url : String(input);
      const method = request?.method ?? init?.method ?? "GET";
      const body = request ? await request.clone().text() : (init?.body as string);
      calls.push({ url, method, body });
      if (url.includes("deletion-preview")) {
        return new Response(JSON.stringify({ data: { ownedFarmCount } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (method === "DELETE" && deleteStatus !== 204) {
        // Tel que le backend le renvoie : RFC 7807 complet. `parseApiError` reconnaît une
        // réponse d'erreur à son `title` — sans lui, le message réel serait remplacé par
        // « Une erreur est survenue », et le test validerait un affichage qui n'arrive jamais.
        return new Response(
          JSON.stringify({
            type: "https://avicare.com/errors/forbidden",
            title: "Forbidden",
            status: deleteStatus,
            detail: "Mot de passe incorrect. Le compte n'a pas été supprimé.",
            code: "ACCOUNT_DELETE_BAD_PASSWORD",
          }),
          { status: deleteStatus, headers: { "Content-Type": "application/problem+json" } },
        );
      }
      return new Response(null, { status: 204 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("DeleteAccountPanel", () => {
  it("nomme ce qui disparaît quand l'utilisateur possède une ferme", async () => {
    // Le produit efface la ferme entière : le dire vaguement reviendrait à le cacher.
    mockApi({ ownedFarmCount: 1 });
    renderWithProviders(<DeleteAccountPanel open />);

    expect(
      await screen.findByText(/bandes, ventes, factures, dépenses/),
    ).toBeInTheDocument();
    expect(screen.getByText(/tous les autres membres/)).toBeInTheDocument();
  });

  it("dit au contraire que les fermes survivent à un simple membre", async () => {
    // Gérant, ouvrier, vétérinaire : la ferme n'a jamais été la leur.
    mockApi({ ownedFarmCount: 0 });
    renderWithProviders(<DeleteAccountPanel open />);

    expect(await screen.findByText(/elles ne sont pas supprimées/)).toBeInTheDocument();
  });

  it("n'interroge pas le serveur tant que l'onglet est fermé", () => {
    const calls = mockApi();
    renderWithProviders(<DeleteAccountPanel open={false} />);

    expect(calls).toHaveLength(0);
  });

  it("garde le bouton inerte tant que la confirmation est incomplète", async () => {
    const user = userEvent.setup();
    mockApi();
    renderWithProviders(<DeleteAccountPanel open />);
    await screen.findByText(/Vos informations personnelles/);

    const button = screen.getByRole("button", { name: /Supprimer définitivement/ });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/Votre mot de passe/), "Test1234!");
    // Un mot approchant ne suffit pas : une case à cocher se coche par réflexe, pas un mot.
    await user.type(screen.getByLabelText(/Tapez SUPPRIMER/), "SUPPRIM");
    expect(button).toBeDisabled();
  });

  it("supprime le compte quand tout est saisi", async () => {
    const user = userEvent.setup();
    const calls = mockApi();
    renderWithProviders(<DeleteAccountPanel open />);
    await screen.findByText(/Vos informations personnelles/);

    await user.type(screen.getByLabelText(/Votre mot de passe/), "Test1234!");
    await user.type(screen.getByLabelText(/Tapez SUPPRIMER/), "supprimer");
    await user.click(screen.getByRole("button", { name: /Supprimer définitivement/ }));

    await waitFor(() => {
      const del = calls.find((c) => c.method === "DELETE");
      expect(del?.url).toContain("/api/v1/account");
      expect(del?.body).toContain("Test1234!");
    });
  });

  it("affiche le refus du serveur", async () => {
    const user = userEvent.setup();
    mockApi({ deleteStatus: 403 });
    renderWithProviders(<DeleteAccountPanel open />);
    await screen.findByText(/Vos informations personnelles/);

    await user.type(screen.getByLabelText(/Votre mot de passe/), "mauvais");
    await user.type(screen.getByLabelText(/Tapez SUPPRIMER/), "SUPPRIMER");
    await user.click(screen.getByRole("button", { name: /Supprimer définitivement/ }));

    expect(await screen.findByText(/Mot de passe incorrect/)).toBeInTheDocument();
  });
});
