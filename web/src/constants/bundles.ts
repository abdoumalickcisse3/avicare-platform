/**
 * Module display labels and the custom-plan contact, used by the signup wizard
 * and the farm subscription tab.
 *
 * The Plan → Modules mapping itself is NO LONGER hardcoded here: it is the
 * backend's responsibility (Décision 16), served by `GET /subscription/plans`
 * and consumed via `useGetPlansQuery`. Only UI labels (not provided by the API)
 * remain in this file.
 */

export const CUSTOM_BUNDLE_EMAIL = "contact@avicare.com";

/** French labels for module keys (doc 00 §7). */
export const MODULE_LABELS: Record<string, string> = {
  "module.poultry.broiler": "Volaille chair",
  "module.poultry.layer": "Volaille ponte",
  "module.health.basic": "Suivi sanitaire",
  "module.health.advanced": "Sanitaire avancé",
  "module.commercial.basic": "Commercial",
  "module.commercial.advanced": "Commercial avancé",
  "module.inventory": "Stocks",
  "module.finance": "Finance",
  "module.kpi.advanced": "KPI avancés",
  "module.buyer_portal": "Portail acheteur",
  "module.qr_codes": "QR codes",
  "module.api_access": "Accès API",
};

/** Human label for a module key, falling back to the raw key. */
export function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? key;
}

/** Display price from a plan's monthly XOF price, or "Devis" for a quote plan. */
export function planPriceLabel(priceXof: number | null): string {
  if (priceXof == null) return "Devis";
  return `${new Intl.NumberFormat("fr-SN").format(priceXof)} F/mois`;
}
