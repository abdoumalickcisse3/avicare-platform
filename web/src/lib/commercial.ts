import type {
  Client,
  ClientType,
  DeliveryStatus,
  Invoice,
  InvoiceStatus,
  Order,
  OrderStatus,
  Payment,
  PaymentMethod,
  Sale,
  SaleStatus,
} from "@/types";
import { colors } from "@/theme/tokens";

/** Human labels (FR) for the client types. */
export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  INDIVIDUAL: "Particulier",
  BUSINESS: "Entreprise",
  WHOLESALER: "Grossiste",
};

export const CLIENT_TYPE_OPTIONS: ClientType[] = [
  "INDIVIDUAL",
  "BUSINESS",
  "WHOLESALER",
];

/** Up to two uppercase initials from a display name, for the client avatar. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** A client is "at risk" when they have a limit and their receivable exceeds it (D26). */
export function isOverLimit(client: Client): boolean {
  return client.creditLimitXof != null && client.currentBalanceXof > client.creditLimitXof;
}

/** Payment methods offered for a direct sale (FR labels). Mirrors backend PaymentMethod. */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  BANK_TRANSFER: "Virement",
};

export const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = [
  "CASH",
  "MOBILE_MONEY",
  "BANK_TRANSFER",
];

/** Colour + label for a sale status chip. */
export const SALE_STATUS_META: Record<SaleStatus, { label: string; color: string; bg: string }> = {
  COMPLETED: { label: "Payé", color: colors.success.dark, bg: colors.success.light },
  CANCELLED: { label: "Annulée", color: colors.neutral[600], bg: colors.neutral[200] },
};

/** Colour + label for an order status chip (D23). */
export const ORDER_STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: "En attente", color: colors.neutral[700], bg: colors.neutral[200] },
  CONFIRMED: { label: "Confirmée", color: colors.info.dark, bg: colors.info.light },
  IN_PROGRESS: { label: "En préparation", color: colors.accent[700], bg: colors.accent[100] },
  DELIVERED: { label: "Livrée", color: colors.success.dark, bg: colors.success.light },
  CANCELLED: { label: "Annulée", color: colors.neutral[600], bg: colors.neutral[200] },
};

/** The happy-path order progression, for the per-order stepper (not a Kanban). */
export const ORDER_STATUS_FLOW: { status: OrderStatus; label: string }[] = [
  { status: "PENDING", label: "En attente" },
  { status: "CONFIRMED", label: "Confirmée" },
  { status: "IN_PROGRESS", label: "En préparation" },
  { status: "DELIVERED", label: "Livrée" },
];

/** Colour + label for a delivery status chip. */
export const DELIVERY_STATUS_META: Record<
  DeliveryStatus,
  { label: string; color: string; bg: string }
> = {
  DELIVERED: { label: "Livrée", color: colors.success.dark, bg: colors.success.light },
  CANCELLED: { label: "Annulée", color: colors.neutral[600], bg: colors.neutral[200] },
};

/** Colour + label for an invoice status chip. */
export const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; color: string; bg: string }
> = {
  ISSUED: { label: "Émise", color: colors.accent[700], bg: colors.accent[100] },
  PARTIALLY_PAID: { label: "Partielle", color: colors.info.dark, bg: colors.info.light },
  PAID: { label: "Payée", color: colors.success.dark, bg: colors.success.light },
  CANCELLED: { label: "Annulée", color: colors.neutral[600], bg: colors.neutral[200] },
};

/**
 * An invoice is overdue when its due date has passed and it is neither fully paid
 * nor cancelled (derived, mirrors the backend listOverdue, Décision D26).
 */
export function isInvoiceOverdue(inv: Invoice): boolean {
  if (inv.status === "PAID" || inv.status === "CANCELLED") return false;
  if (!inv.dueDate) return false;
  return new Date(inv.dueDate).getTime() < Date.now();
}

/**
 * Credit usage of a client as a fraction of their limit (Décision D26 — purely
 * indicative). Returns null when there is no limit. May exceed 1 (over limit).
 */
export function creditRatio(client: Client): number | null {
  if (client.creditLimitXof == null || client.creditLimitXof <= 0) return null;
  return client.currentBalanceXof / client.creditLimitXof;
}

/**
 * Colour for the receivable / credit bar: green under 80% of the limit, orange
 * up to the limit, red over it. Neutral when there is no limit. Mirrors the
 * "warning, never blocks" spirit of D26.
 */
export function creditColor(client: Client): string {
  const ratio = creditRatio(client);
  if (ratio == null) return colors.neutral[400];
  if (ratio > 1) return colors.error.main;
  if (ratio >= 0.8) return colors.warning.main;
  return colors.success.main;
}

// ── Next-step logic (R2.1) ───────────────────────────────────────────────────

export type NextStepKind =
  | "confirm"
  | "startPreparation"
  | "deliver"
  | "invoiceFromDelivery"
  | "invoiceFromSale"
  | "recordPayment"
  | "none";

export interface NextStep {
  kind: NextStepKind;
  label: string;
}

const NONE: NextStep = { kind: "none", label: "" };

/**
 * Returns the primary next action for a sales order.
 * @param o         The order to evaluate.
 * @param hasInvoice Whether an invoice already exists for this order's delivery.
 */
export function orderNextStep(o: Order, hasInvoice: boolean): NextStep {
  switch (o.status) {
    case "PENDING":
      return { kind: "confirm", label: "Confirmer" };
    case "CONFIRMED":
      return { kind: "startPreparation", label: "Préparer" };
    case "IN_PROGRESS":
      return { kind: "deliver", label: "Livrer" };
    case "DELIVERED":
      return hasInvoice ? NONE : { kind: "invoiceFromDelivery", label: "Générer la facture" };
    default:
      return NONE;
  }
}

/**
 * Returns the primary next action for an invoice.
 */
export function invoiceNextStep(i: Invoice): NextStep {
  if (i.status === "CANCELLED" || i.status === "PAID") return NONE;
  return i.outstandingXof > 0 ? { kind: "recordPayment", label: "Encaisser" } : NONE;
}

/**
 * Returns the primary next action for a direct sale.
 * @param s          The sale to evaluate.
 * @param hasInvoice Whether an invoice already exists for this sale.
 */
export function saleNextStep(s: Sale, hasInvoice: boolean): NextStep {
  if (s.status !== "COMPLETED" || hasInvoice) return NONE;
  return { kind: "invoiceFromSale", label: "Générer la facture" };
}

// ── Client timeline (R3) ─────────────────────────────────────────────────────

export type TimelineKind = "order" | "sale" | "invoice" | "payment";

export interface TimelineEntry {
  kind: TimelineKind;
  id: number;
  date: string;
  label: string;
  amountXof: number;
  href: string;
}

/**
 * Aggregates orders, sales, invoices, and payments into a unified commercial
 * timeline for a client's compte-courant view. Sorted by date descending.
 */
export function buildClientTimeline(input: {
  orders: Order[];
  sales: Sale[];
  invoices: Invoice[];
  payments: Payment[];
}): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const o of input.orders) {
    entries.push({
      kind: "order",
      id: o.id,
      date: o.orderDate,
      label: o.orderNumber,
      amountXof: o.totalXof ?? 0,
      href: `/commercial/commandes/${o.id}`,
    });
  }

  for (const s of input.sales) {
    entries.push({
      kind: "sale",
      id: s.id,
      date: s.saleDate,
      label: s.saleNumber,
      amountXof: s.totalXof,
      href: `/commercial/ventes`,
    });
  }

  for (const i of input.invoices) {
    entries.push({
      kind: "invoice",
      id: i.id,
      date: i.issueDate,
      label: i.invoiceNumber,
      amountXof: i.totalXof,
      href: `/commercial/factures/${i.id}`,
    });
  }

  for (const p of input.payments) {
    entries.push({
      kind: "payment",
      id: p.id,
      date: p.paymentDate,
      label: p.paymentNumber,
      amountXof: p.amountXof,
      href: `/commercial/factures/${p.invoiceId}`,
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
