import { describe, expect, it } from "vitest";
import { buildClientTimeline } from "./commercial";
import type { Order, Sale, Invoice, Payment } from "@/types";

describe("buildClientTimeline", () => {
  it("merges and sorts by date desc with correct kinds/hrefs", () => {
    const t = buildClientTimeline({
      orders: [{ id: 1, orderNumber: "ORD-1", orderDate: "2026-01-01", totalXof: 1000 }] as unknown as Order[],
      sales: [{ id: 2, saleNumber: "V-1", saleDate: "2026-03-01", totalXof: 2000 }] as unknown as Sale[],
      invoices: [{ id: 3, invoiceNumber: "F-1", issueDate: "2026-02-01", totalXof: 1500 }] as unknown as Invoice[],
      payments: [{ id: 4, paymentNumber: "P-1", paymentDate: "2026-04-01", amountXof: 500, invoiceId: 3 }] as unknown as Payment[],
    });
    expect(t.map((e) => e.kind)).toEqual(["payment", "sale", "invoice", "order"]);
    // payment links to its invoice page
    expect(t[0].href).toBe("/commercial/factures/3");
  });

  it("maps order href to /commercial/commandes/{id}", () => {
    const t = buildClientTimeline({
      orders: [{ id: 7, orderNumber: "ORD-7", orderDate: "2026-05-01", totalXof: null }] as unknown as Order[],
      sales: [],
      invoices: [],
      payments: [],
    });
    expect(t[0].href).toBe("/commercial/commandes/7");
    expect(t[0].kind).toBe("order");
    expect(t[0].label).toBe("ORD-7");
    expect(t[0].amountXof).toBe(0); // null totalXof → 0
  });

  it("maps sale href to /commercial/ventes (list, no detail)", () => {
    const t = buildClientTimeline({
      orders: [],
      sales: [{ id: 5, saleNumber: "V-5", saleDate: "2026-06-01", totalXof: 3000 }] as unknown as Sale[],
      invoices: [],
      payments: [],
    });
    expect(t[0].href).toBe("/commercial/ventes");
    expect(t[0].kind).toBe("sale");
    expect(t[0].label).toBe("V-5");
    expect(t[0].amountXof).toBe(3000);
  });

  it("maps invoice href to /commercial/factures/{id}", () => {
    const t = buildClientTimeline({
      orders: [],
      sales: [],
      invoices: [{ id: 9, invoiceNumber: "F-9", issueDate: "2026-06-10", totalXof: 7500 }] as unknown as Invoice[],
      payments: [],
    });
    expect(t[0].href).toBe("/commercial/factures/9");
    expect(t[0].kind).toBe("invoice");
    expect(t[0].label).toBe("F-9");
    expect(t[0].amountXof).toBe(7500);
  });

  it("returns empty array when all inputs are empty", () => {
    const t = buildClientTimeline({ orders: [], sales: [], invoices: [], payments: [] });
    expect(t).toHaveLength(0);
  });
});
