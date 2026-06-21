import { describe, expect, it } from "vitest";
import { orderNextStep, invoiceNextStep, saleNextStep } from "./commercial";
import type { Order, Invoice, Sale } from "@/types";

const order = (status: Order["status"]): Order =>
  ({ status, items: [] } as unknown as Order);

describe("orderNextStep", () => {
  it("PENDING → confirm", () => expect(orderNextStep(order("PENDING"), false).kind).toBe("confirm"));
  it("CONFIRMED → startPreparation", () => expect(orderNextStep(order("CONFIRMED"), false).kind).toBe("startPreparation"));
  it("IN_PROGRESS → deliver", () => expect(orderNextStep(order("IN_PROGRESS"), false).kind).toBe("deliver"));
  it("DELIVERED + not invoiced → invoiceFromDelivery", () =>
    expect(orderNextStep(order("DELIVERED"), false).kind).toBe("invoiceFromDelivery"));
  it("DELIVERED + invoiced → none", () =>
    expect(orderNextStep(order("DELIVERED"), true).kind).toBe("none"));
  it("CANCELLED → none", () => expect(orderNextStep(order("CANCELLED"), false).kind).toBe("none"));
});

describe("invoiceNextStep", () => {
  const inv = (status: Invoice["status"], outstanding: number): Invoice =>
    ({ status, outstandingXof: outstanding } as unknown as Invoice);
  it("ISSUED with due → recordPayment", () => expect(invoiceNextStep(inv("ISSUED", 1000)).kind).toBe("recordPayment"));
  it("PARTIALLY_PAID with due → recordPayment", () => expect(invoiceNextStep(inv("PARTIALLY_PAID", 500)).kind).toBe("recordPayment"));
  it("PAID → none", () => expect(invoiceNextStep(inv("PAID", 0)).kind).toBe("none"));
  it("CANCELLED → none", () => expect(invoiceNextStep(inv("CANCELLED", 0)).kind).toBe("none"));
});

describe("saleNextStep", () => {
  const sale = (status: Sale["status"]): Sale => ({ status } as unknown as Sale);
  it("COMPLETED + not invoiced → invoiceFromSale (optional)", () =>
    expect(saleNextStep(sale("COMPLETED"), false).kind).toBe("invoiceFromSale"));
  it("COMPLETED + invoiced → none", () => expect(saleNextStep(sale("COMPLETED"), true).kind).toBe("none"));
  it("CANCELLED → none", () => expect(saleNextStep(sale("CANCELLED"), false).kind).toBe("none"));
});
