import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdfDocument } from "./InvoicePdfDocument";
import type { Client, Invoice } from "@/types";

const invoice: Invoice = {
  id: 17,
  farmId: 1,
  invoiceNumber: "F-2026-007",
  clientId: 3,
  sourceType: "SALE",
  saleId: 9,
  deliveryId: null,
  status: "PAID",
  issueDate: "2026-07-14",
  dueDate: "2026-07-15",
  totalXof: 46200,
  amountPaidXof: 46200,
  outstandingXof: 0,
  notes: "Merci pour votre confiance — livraison à Thiès.",
  items: [
    {
      id: 1,
      articleKey: "eggs.tray",
      articleSource: "PRODUCTION",
      // "Œufs" exercises the Œ ligature through Helvetica/WinAnsi.
      articleLabelSnapshot: "Œufs",
      unit: "plateau",
      quantity: 21,
      unitPriceXof: 2200,
      lineTotalXof: 46200,
      notes: null,
    },
  ],
};

const client: Client = {
  id: 3,
  farmId: 1,
  clientType: "INDIVIDUAL",
  displayName: "Fatou Ndiaye",
  legalName: null,
  phone: "+221 77 123 45 67",
  email: null,
  address: "Quartier Médina",
  city: "Thiès",
  creditLimitXof: 500000,
  currentBalanceXof: 0,
  defaultPaymentTerms: null,
  active: true,
  notes: null,
};

describe("InvoicePdfDocument", () => {
  it("renders a valid, non-empty PDF (French text and Œ ligature included)", async () => {
    const buffer = await renderToBuffer(
      <InvoicePdfDocument invoice={invoice} client={client} farmName="Ferme Complète" />,
    );
    // A real PDF starts with the "%PDF-" magic bytes...
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // ...and a one-page invoice with a table is comfortably over 1 KB.
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("renders without a client (Comptant / cash sale)", async () => {
    const cashInvoice: Invoice = { ...invoice, clientId: null };
    const buffer = await renderToBuffer(
      <InvoicePdfDocument invoice={cashInvoice} farmName="Ferme Complète" />,
    );
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
