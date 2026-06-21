import type {
  Client,
  ClientType,
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
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
