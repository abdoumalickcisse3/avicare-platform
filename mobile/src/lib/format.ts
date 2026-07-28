/**
 * Hermes-safe formatters (Senegal / XOF). `Intl.NumberFormat` with a locale is
 * unreliable on Android Hermes without the Intl build variant, so grouping is
 * done manually with a space separator — the French/West-African convention
 * (brief · "120 000 F").
 */

/** Group thousands with a space: 4820 → "4 820". */
export function formatNumber(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return sign + Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Amount in XOF: 120000 → "120 000 F". */
export function formatCurrency(n: number): string {
  return `${formatNumber(n)} F`;
}

/** Compact French relative time from an ISO timestamp. */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} j`;
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
