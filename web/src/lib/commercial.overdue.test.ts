import { afterEach, describe, expect, it, vi } from "vitest";
import { isInvoiceOverdue } from "./commercial";
import type { Invoice } from "@/types";

/** Minimal invoice: only the three fields the predicate reads actually matter. */
function invoice(over: Partial<Invoice>): Invoice {
  return {
    id: 1,
    farmId: 7,
    invoiceNumber: "F-2026-001",
    clientId: 3,
    status: "ISSUED",
    issueDate: "2026-09-01",
    dueDate: "2026-09-07",
    totalXof: 12000,
    amountPaidXof: 0,
    outstandingXof: 12000,
    ...over,
  } as Invoice;
}

/** Freeze the clock at a local wall time on 7 September 2026. */
function on(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

afterEach(() => vi.useRealTimers());

describe("isInvoiceOverdue", () => {
  it("n'est pas en retard le jour même de l'échéance", () => {
    // Le défaut corrigé : `new Date("2026-09-07") < Date.now()` était vrai dès minuit UTC, si
    // bien que le client était annoncé en retard alors qu'il avait jusqu'au soir pour payer.
    on("2026-09-07T10:00:00");
    expect(isInvoiceOverdue(invoice({ dueDate: "2026-09-07" }))).toBe(false);
  });

  it("l'est encore le soir du jour de l'échéance", () => {
    on("2026-09-07T23:30:00");
    expect(isInvoiceOverdue(invoice({ dueDate: "2026-09-07" }))).toBe(false);
  });

  it("l'est le lendemain, comme le backend (due_date < today)", () => {
    on("2026-09-08T00:30:00");
    expect(isInvoiceOverdue(invoice({ dueDate: "2026-09-07" }))).toBe(true);
  });

  it("ignore une facture payée ou annulée, même échue", () => {
    on("2026-09-20T10:00:00");
    expect(isInvoiceOverdue(invoice({ status: "PAID" }))).toBe(false);
    expect(isInvoiceOverdue(invoice({ status: "CANCELLED" }))).toBe(false);
  });

  it("compte une facture partiellement payée et échue", () => {
    on("2026-09-20T10:00:00");
    expect(isInvoiceOverdue(invoice({ status: "PARTIALLY_PAID" }))).toBe(true);
  });

  it("ignore une facture sans échéance", () => {
    on("2026-09-20T10:00:00");
    expect(isInvoiceOverdue(invoice({ dueDate: null }))).toBe(false);
  });
});
