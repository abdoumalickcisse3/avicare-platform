/**
 * Subscription bundles — V1 source of truth is docs/00-vision-strategique.md §7.
 *
 * TECH DEBT: these are hardcoded in the frontend because the backend has no
 * bundle catalog endpoint yet. Replace with `GET /api/v1/subscription/bundles`
 * in Sprint C1 (polish). Keep this file the single source so the swap is local.
 */

export type LivestockType = "BROILER" | "LAYER" | "MIXED";

/** French labels + descriptions for the onboarding livestock-type step. */
export const LIVESTOCK_TYPES: {
  value: LivestockType;
  label: string;
  description: string;
}[] = [
  {
    value: "BROILER",
    label: "Poulets de chair",
    description: "Élevage de volaille pour la viande.",
  },
  {
    value: "LAYER",
    label: "Poules pondeuses",
    description: "Production d'œufs de consommation.",
  },
  {
    value: "MIXED",
    label: "Mixte",
    description: "Chair et ponte sur la même exploitation.",
  },
];

/** Production modules implied by the chosen livestock type. */
const LIVESTOCK_TYPE_MODULES: Record<LivestockType, string[]> = {
  BROILER: ["module.poultry.broiler"],
  LAYER: ["module.poultry.layer"],
  MIXED: ["module.poultry.broiler", "module.poultry.layer"],
};

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

export interface Bundle {
  /** Stable key used as the subscription planKey / change-request requestedPlan. */
  key: string;
  name: string;
  /** Display price, e.g. "15 000 F/mois" or "Devis". */
  priceLabel: string;
  description: string;
  features: string[];
  /** Transverse modules always included by the bundle. */
  baseModules: string[];
  /** Whether to prepend the livestock-type production modules. */
  usesTypeModules?: boolean;
  /** Whether the bundle includes every module (Ferme Complète). */
  includesAllModules?: boolean;
  /** "Sur mesure" — no instant activation, opens a mailto instead. */
  custom?: boolean;
}

export const CUSTOM_BUNDLE_EMAIL = "contact@avicare.com";

export const BUNDLES: Bundle[] = [
  {
    key: "starter",
    name: "Starter Volaille",
    priceLabel: "15 000 F/mois",
    description: "Pour les petites exploitations familiales.",
    features: ["1 ferme", "Jusqu'à 100 animaux", "Suivi sanitaire de base"],
    baseModules: ["module.health.basic"],
    usesTypeModules: true,
  },
  {
    key: "pro",
    name: "Pro Volaille",
    priceLabel: "25 000 F/mois",
    description: "Pour les fermes en croissance.",
    features: [
      "Jusqu'à 3 fermes · 3 000 animaux",
      "Chair + ponte",
      "Sanitaire avancé · commercial · stocks",
    ],
    baseModules: [
      "module.poultry.broiler",
      "module.poultry.layer",
      "module.health.advanced",
      "module.commercial.basic",
      "module.inventory",
    ],
  },
  {
    key: "complete",
    name: "Ferme Complète",
    priceLabel: "45 000 F/mois",
    description: "Tous les modules, pour les complexes avicoles.",
    features: [
      "Jusqu'à 10 fermes · 10 000 animaux",
      "Tous les modules inclus",
      "Finance · KPI · QR · portail acheteur",
    ],
    baseModules: [],
    includesAllModules: true,
  },
  {
    key: "custom",
    name: "Sur mesure",
    priceLabel: "Devis",
    description: "Besoins spécifiques ou grande échelle.",
    features: ["À la carte", "Account manager dédié", "API & intégrations"],
    baseModules: [],
    custom: true,
  },
];

/** Resolve the set of module keys a bundle activates for a given livestock type. */
export function modulesForBundle(
  bundle: Bundle,
  type: LivestockType,
): string[] {
  if (bundle.includesAllModules) return [...ALL_MODULE_KEYS];
  const keys = new Set<string>(bundle.baseModules);
  if (bundle.usesTypeModules) {
    for (const k of LIVESTOCK_TYPE_MODULES[type]) keys.add(k);
  }
  return [...keys];
}
