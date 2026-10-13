import { dueState } from "../invoiceDocument";
import type { Invoice } from "@/types";

const base = { status: "ISSUED", dueDate: "2026-10-28" } as unknown as Invoice;

describe("dueState", () => {
  it("ne dit rien quand il n'y a pas d'échéance", () => {
    expect(dueState({ ...base, dueDate: null } as Invoice, "2026-10-13").kind).toBe("none");
  });

  it("se tait sur une facture soldée ou annulée", () => {
    // Rappeler une échéance passée sur un document payé ne ferait qu'inquiéter
    // le client qui le reçoit.
    expect(dueState({ ...base, status: "PAID" } as Invoice, "2027-01-01").kind).toBe("none");
    expect(dueState({ ...base, status: "CANCELLED" } as Invoice, "2027-01-01").kind).toBe("none");
  });

  it("ne met pas en retard une facture due aujourd'hui", () => {
    // Le piège déjà corrigé ailleurs : comparer des DATES, pas des instants.
    // L'éleveur a jusqu'au soir pour être payé.
    const state = dueState(base, "2026-10-28");
    expect(state.kind).toBe("due-soon");
    expect(state.kind === "due-soon" && state.label).toBe("Échéance aujourd'hui");
  });

  it("compte les jours restants, au singulier comme au pluriel", () => {
    expect(dueState(base, "2026-10-27")).toMatchObject({ kind: "due-soon", label: "Échéance demain" });
    expect(dueState(base, "2026-10-13")).toMatchObject({ kind: "due-soon", label: "Échéance dans 15 j" });
  });

  it("ne crie pas pour une échéance encore lointaine", () => {
    expect(dueState(base, "2026-10-01").kind).toBe("later");
  });

  it("compte les jours de retard", () => {
    expect(dueState(base, "2026-10-29")).toMatchObject({ kind: "overdue", label: "En retard d'1 j" });
    expect(dueState(base, "2026-11-07")).toMatchObject({ kind: "overdue", label: "En retard de 10 j" });
  });

  it("traverse un changement d'heure sans décaler d'un jour", () => {
    // Le passage à l'heure d'hiver tombe fin octobre : en heure locale, l'écart
    // ferait 15,04 jours et l'arrondi pourrait basculer.
    expect(dueState({ ...base, dueDate: "2026-11-01" } as Invoice, "2026-10-25")).toMatchObject({
      kind: "due-soon",
      label: "Échéance dans 7 j",
    });
  });
});
