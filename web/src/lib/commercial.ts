import type { Client, ClientType } from "@/types";
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
