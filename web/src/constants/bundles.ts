/**
 * Subscription bundles — V1 source of truth is docs/00-vision-strategique.md §7.
 *
 * Chosen during the signup wizard (step 2). Each bundle carries a STATIC set of
 * module keys that are activated (enabled) on the new farm after signup.
 *
 * TECH DEBT: hardcoded because the backend has no bundle catalog endpoint yet.
 * Replace with `GET /api/v1/subscription/bundles` in Sprint C1 (polish). Keep
 * this file the single source so the swap is local.
 */

export const CUSTOM_BUNDLE_EMAIL = "contact@avicare.com";

/** Every V1 module key (doc 00 §7) — used by the "Ferme Complète" bundle. */
export const ALL_MODULE_KEYS: string[] = [
  "module.poultry.broiler",
  "module.poultry.layer",
  "module.health.basic",
  "module.health.advanced",
  "module.commercial.basic",
  "module.commercial.advanced",
  "module.inventory",
  "module.finance",
  "module.kpi.advanced",
  "module.buyer_portal",
  "module.qr_codes",
  "module.api_access",
];

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

export type BundleKey = "starter" | "pro" | "complete" | "custom";

export interface Bundle {
  key: BundleKey;
  name: string;
  /** Monthly price in XOF, or null for the custom (quote) bundle. */
  priceXOF: number | null;
  /** Module keys activated on the farm when this bundle is selected. */
  modules: string[];
  features: string[];
  /** Visually emphasised plan in the picker. */
  highlighted?: boolean;
  /** "Sur mesure" — no instant activation, opens a mailto instead. */
  custom?: boolean;
}

const STARTER: Bundle = {
  key: "starter",
  name: "Starter Volaille",
  priceXOF: 15_000,
  // doc 00 §7: 1 species + health.basic. Hardcoded with both poultry modules
  // so the bundle works whatever the farmer raises (refined in C1).
  modules: ["module.poultry.broiler", "module.poultry.layer", "module.health.basic"],
  features: ["1 ferme", "Jusqu'à 100 animaux", "Suivi sanitaire de base"],
};

const PRO: Bundle = {
  key: "pro",
  name: "Pro Volaille",
  priceXOF: 25_000,
  modules: [
    "module.poultry.broiler",
    "module.poultry.layer",
    "module.health.advanced",
    "module.commercial.basic",
    "module.inventory",
  ],
  features: [
    "Jusqu'à 3 fermes · 3 000 animaux",
    "Chair + ponte",
    "Sanitaire avancé · commercial · stocks",
  ],
  highlighted: true,
};

const COMPLETE: Bundle = {
  key: "complete",
  name: "Ferme Complète",
  priceXOF: 45_000,
  modules: [...ALL_MODULE_KEYS],
  features: [
    "Jusqu'à 10 fermes · 10 000 animaux",
    "Tous les modules inclus",
    "Finance · KPI · QR · portail acheteur",
  ],
};

const CUSTOM: Bundle = {
  key: "custom",
  name: "Sur mesure",
  priceXOF: null,
  modules: [],
  features: ["À la carte", "Account manager dédié", "API & intégrations"],
  custom: true,
};

export const BUNDLES: Bundle[] = [STARTER, PRO, COMPLETE, CUSTOM];

/** Display price, e.g. "15 000 F/mois" or "Devis" for the custom bundle. */
export function bundlePriceLabel(bundle: Bundle): string {
  if (bundle.priceXOF == null) return "Devis";
  return `${new Intl.NumberFormat("fr-SN").format(bundle.priceXOF)} F/mois`;
}
