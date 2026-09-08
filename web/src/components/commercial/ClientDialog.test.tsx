import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render";
import type { Client } from "@/types";

/**
 * Le consentement WhatsApp d'un client est un primitif côté serveur : le PUT remplace la ligne,
 * et un champ omis vaut `false` — il révoque le consentement sans que personne l'ait voulu.
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { ClientDialog } from "./ClientDialog";

const CLIENT = {
  id: 3,
  farmId: 7,
  clientType: "BUSINESS",
  displayName: "Boutique Fatou",
  legalName: "Fatou SARL",
  phone: "770000000",
  email: null,
  address: null,
  city: "Thiès",
  creditLimitXof: 200000,
  currentBalanceXof: 12000,
  defaultPaymentTerms: null,
  active: true,
  notes: null,
  notifyWhatsapp: true,
} as unknown as Client;

/** `onWrite` reçoit le corps de la requête d'écriture. */
function mockFetch(onWrite: (body: Record<string, unknown>) => void) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
      if (method !== "GET") {
        const raw =
          input instanceof Request ? await input.clone().text() : String(init?.body ?? "");
        onWrite(raw ? JSON.parse(raw) : {});
      }
      return new Response(JSON.stringify({ data: CLIENT }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

/**
 * L'interrupteur MUI, par son input.
 *
 * `Switch` rend un input `type=checkbox` que MUI ne relie pas au libellé composé du
 * `FormControlLabel` : c'est l'`aria-label` posé dessus (via `slotProps.input`, `inputProps`
 * étant déprécié en v9) qui le nomme — pour ce test comme pour un lecteur d'écran.
 */
const findSwitch = () => screen.findByLabelText("Prévenir par WhatsApp");

afterEach(() => vi.unstubAllGlobals());

describe("ClientDialog — consentement WhatsApp", () => {
  it("renvoie le consentement d'un client qui l'avait accordé", async () => {
    const bodies: Record<string, unknown>[] = [];
    mockFetch((b) => bodies.push(b));
    renderWithProviders(<ClientDialog open onClose={vi.fn()} farmId={7} client={CLIENT} />);

    await userEvent.click(await screen.findByRole("button", { name: "Enregistrer" }));

    expect(bodies[0]?.notifyWhatsapp).toBe(true);
  });

  it("n'accorde rien sans numéro de téléphone", async () => {
    const bodies: Record<string, unknown>[] = [];
    mockFetch((b) => bodies.push(b));
    renderWithProviders(
      <ClientDialog
        open
        onClose={vi.fn()}
        farmId={7}
        client={{ ...CLIENT, phone: null } as Client}
      />,
    );

    // Un interrupteur sans numéro n'envoie nulle part.
    expect(await findSwitch()).toBeDisabled();
    expect(screen.getByText(/Renseignez un téléphone/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(bodies[0]?.notifyWhatsapp).toBe(false);
  });

  it("révoque le consentement quand on éteint l'interrupteur", async () => {
    const bodies: Record<string, unknown>[] = [];
    mockFetch((b) => bodies.push(b));
    renderWithProviders(<ClientDialog open onClose={vi.fn()} farmId={7} client={CLIENT} />);

    await userEvent.click(await findSwitch());
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(bodies[0]?.notifyWhatsapp).toBe(false);
  });
});
