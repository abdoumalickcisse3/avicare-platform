/**
 * The questionnaire's own words, keyed by the value the server stores.
 *
 * The console shows the respondent's answer the way the respondent read it — anything else makes
 * two vocabularies for one fact, and a staff member reading `ONLY_IF_OTHERS_PAY` has to go and find
 * the form to know what was actually asked. Taken verbatim from `landing/src/pages/enquete.astro`:
 * if a wording changes there, it changes here.
 *
 * **One map per question, never a flat one.** `NOTHING` exists in two of these and does not mean
 * the same thing twice — "Rien du tout" for how records are kept, "Rien" for what someone would
 * pay. A single lookup table would silently answer the wrong question.
 */

export const COUNTRY_LABELS: Record<string, string> = {
  SN: "Sénégal",
  CI: "Côte d'Ivoire",
  BJ: "Bénin",
  ML: "Mali",
  BF: "Burkina Faso",
  TG: "Togo",
  NE: "Niger",
  GN: "Guinée",
  CM: "Cameroun",
  XX: "Autre",
};

export const FLOCK_TYPE_LABELS: Record<string, string> = {
  BROILER: "Poulets de chair",
  LAYER: "Poules pondeuses",
  BOTH: "Chair et ponte",
  HATCHERY: "Poussins (reproduction)",
};

export const PAYMENT_TERMS_LABELS: Record<string, string> = {
  CASH: "Comptant",
  CREDIT: "À crédit",
};

export const MAIN_BUYER_LABELS: Record<string, string> = {
  RESELLER: "Bana-bana / revendeur",
  SHOPKEEPER: "Boutiquier du quartier",
  RESTAURANT: "Restaurant ou hôtel",
  INDIVIDUALS: "Particuliers",
  WHOLESALER: "Grossiste",
  SUPERMARKET: "Grande surface",
  OTHER: "Autre",
};

export const SALE_UNIT_LABELS: Record<string, string> = {
  EGG_TRAY: "le plateau de 30 œufs",
  LIVE_BIRD: "le poulet vif",
};

export const PAYMENT_DELAY_LABELS: Record<string, string> = {
  IMMEDIATE: "Tout de suite",
  UNDER_WEEK: "Moins d'une semaine",
  ONE_TO_FOUR_WEEKS: "1 à 4 semaines",
  OVER_MONTH: "Plus d'un mois",
  VARIES: "Ça dépend",
};

export const FIRST_CALL_LABELS: Record<string, string> = {
  VET: "Un vétérinaire",
  FEED_TECHNICIAN: "Le technicien du provendier",
  WHATSAPP_GROUP: "Un groupe WhatsApp",
  NEIGHBOUR: "Un voisin éleveur",
  NOBODY: "Personne, se débrouille",
};

export const RECORD_KEEPING_LABELS: Record<string, string> = {
  NOTEBOOK: "Sur un cahier",
  MEMORY: "De tête",
  SPREADSHEET: "Sur Excel",
  APP: "Sur une application",
  NOTHING: "Rien du tout",
};

export const WILLINGNESS_LABELS: Record<string, string> = {
  NOTHING: "Rien",
  UNDER_5K: "Moins de 5 000 F",
  FROM_5K_TO_15K: "5 000 à 15 000 F",
  FROM_15K_TO_30K: "15 000 à 30 000 F",
  OVER_30K: "Plus de 30 000 F",
  ONLY_IF_OTHERS_PAY: "Seulement si quelqu'un d'autre paie",
};

/**
 * Translate one stored value, falling back to the raw value.
 *
 * The fallback is deliberate: the day the backend gains an option this file has not heard of, the
 * screen shows `NEW_OPTION` instead of an empty cell. Ugly is recoverable, invisible is not.
 */
export function surveyLabel(
  map: Record<string, string>,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return map[value] ?? value;
}

/** A yes/no/unanswered, where "unanswered" is itself the answer for most respondents. */
export function frenchBoolean(value: boolean | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value ? "Oui" : "Non";
}
