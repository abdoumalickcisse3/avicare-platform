/**
 * Les calculs d'une facture imprimée, séparés de son dessin.
 *
 * Dupliqué à l'identique dans `mobile/src/lib/invoiceDocument.ts`, comme les huit
 * autres modules que les deux applications partagent : une facture doit dire la
 * même chose quelle que soit la machine qui l'imprime.
 */

import type { Invoice } from "@/types";

/** Aujourd'hui en `YYYY-MM-DD`, dans le fuseau local. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export type DueState =
  | { kind: "none" }
  | { kind: "overdue"; days: number; label: string }
  | { kind: "due-soon"; days: number; label: string }
  | { kind: "later" };

/**
 * L'état de l'échéance, tel qu'il s'affiche en pastille à côté de la date.
 *
 * Comparaison de **dates et non d'instants**, comme `isInvoiceOverdue` : une
 * facture due aujourd'hui n'est pas en retard, l'éleveur a jusqu'au soir. Une
 * facture déjà payée n'affiche rien — rappeler une échéance sur un document
 * soldé ne ferait qu'inquiéter le client.
 */
export function dueState(invoice: Invoice, today: string = todayIso()): DueState {
  if (!invoice.dueDate) return { kind: "none" };
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") return { kind: "none" };

  const days = daysBetween(today, invoice.dueDate);
  if (days < 0) {
    const late = -days;
    return { kind: "overdue", days: late, label: late === 1 ? "En retard d'1 j" : `En retard de ${late} j` };
  }
  if (days === 0) return { kind: "due-soon", days: 0, label: "Échéance aujourd'hui" };
  if (days <= 15) {
    return { kind: "due-soon", days, label: days === 1 ? "Échéance demain" : `Échéance dans ${days} j` };
  }
  return { kind: "later" };
}

/** Jours calendaires de `from` à `to`, les deux en `YYYY-MM-DD`. */
function daysBetween(from: string, to: string): number {
  // UTC des deux côtés : sans cela, un passage à l'heure d'été décalerait d'un jour.
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}
