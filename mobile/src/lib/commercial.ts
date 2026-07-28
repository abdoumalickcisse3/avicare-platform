/**
 * Commercial helpers — ported from `web/src/lib/commercial.ts`: client-type
 * labels, avatar initials, and the credit ratio / colour used to render a
 * client's running balance against their credit limit.
 */
import { tokens } from '@/theme';
import type { Client, ClientType } from '@/types';

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  INDIVIDUAL: 'Particulier',
  BUSINESS: 'Entreprise',
  WHOLESALER: 'Grossiste',
};

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Balance ÷ credit limit, or null when the client has no limit set. */
export function creditRatio(client: Client): number | null {
  if (client.creditLimitXof == null || client.creditLimitXof <= 0) return null;
  return client.currentBalanceXof / client.creditLimitXof;
}

/** Colour for the balance/progress: grey (no limit), green/amber/red by ratio. */
export function creditColor(client: Client): string {
  const ratio = creditRatio(client);
  if (ratio == null) return tokens.colors.neutral[400];
  if (ratio > 1) return tokens.colors.error;
  if (ratio >= 0.8) return tokens.colors.warning;
  return tokens.colors.success;
}
