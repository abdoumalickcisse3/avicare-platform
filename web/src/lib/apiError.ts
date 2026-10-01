/**
 * RFC 7807 Problem Details as returned by the backend (doc 06 §1). Used to turn
 * an RTK Query error into a user-facing message.
 */
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code?: string;
  traceId?: string;
}

const NETWORK_MESSAGE = "Pas de connexion. Vérifiez votre réseau puis réessayez.";

/** Fallback when the backend sent no usable body. */
const STATUS_MESSAGES: Record<number, string> = {
  400: "La demande est invalide.",
  401: "Votre session a expiré. Reconnectez-vous.",
  403: "Vous n'avez pas le droit d'effectuer cette action.",
  404: "Élément introuvable.",
  409: "Cet élément a été modifié entre-temps. Rechargez puis recommencez.",
  422: "Cette opération n'est pas possible dans l'état actuel.",
  429: "Trop de tentatives. Patientez un instant.",
  500: "Une erreur est survenue de notre côté.",
  502: "Le service est momentanément indisponible. Réessayez dans un instant.",
  503: "Le service est momentanément indisponible. Réessayez dans un instant.",
  504: "Le service met trop de temps à répondre. Réessayez.",
};

/**
 * The backend writes its `detail` for developers, in English. The codes below are the ones a user
 * can actually hit; they get a sentence they can act on. An unknown code keeps the server's detail.
 */
const CODE_MESSAGES: Record<string, string> = {
  BAD_CREDENTIALS: "Email ou mot de passe incorrect.",
  ACCOUNT_DISABLED: "Ce compte est désactivé. Contactez l'administrateur de votre ferme.",
  EMAIL_ALREADY_USED: "Cet email est déjà utilisé.",
  EMAIL_TAKEN: "Cet email est déjà utilisé.",
  INVALID_REFRESH_TOKEN: "Votre session a expiré. Reconnectez-vous.",
  AUTHENTICATION_FAILED: "Votre session a expiré. Reconnectez-vous.",
  ACCESS_DENIED: "Vous n'avez pas le droit d'effectuer cette action.",
  VALIDATION_FAILED: "Certains champs sont invalides. Vérifiez le formulaire.",
  MALFORMED_REQUEST: "La demande est invalide.",
  RESOURCE_NOT_FOUND: "Élément introuvable.",
  USER_NOT_FOUND: "Utilisateur introuvable.",
  FARM_NOT_FOUND: "Ferme introuvable.",
  ARTICLE_NOT_FOUND: "Article introuvable.",
  PERIOD_INVALID_RANGE: "La date de début doit précéder la date de fin.",
  CLIENT_TYPE_REQUIRED: "Choisissez le type de client.",
  CLIENT_NAME_REQUIRED: "Saisissez le nom du client.",
  SALE_NO_LINES: "Ajoutez au moins une ligne à la vente.",
  SALE_LINE_QUANTITY: "La quantité doit être supérieure à 0.",
  SALE_LINE_PRICE: "Le prix unitaire ne peut pas être négatif.",
  SALE_LINE_WEIGHT: "Le poids doit être supérieur à 0.",
  ORDER_NO_LINES: "Ajoutez au moins une ligne à la commande.",
  ORDER_LINE_QUANTITY: "La quantité doit être supérieure à 0.",
  ORDER_LINE_PRICE: "Le prix unitaire ne peut pas être négatif.",
  PO_NO_LINES: "Ajoutez au moins une ligne au bon d'achat.",
  PO_LINE_PRICE: "Le prix unitaire ne peut pas être négatif.",
  PAYMENT_AMOUNT: "Le montant du paiement doit être supérieur à 0.",
  PAYMENT_METHOD: "Choisissez le mode de paiement.",
  LEDGER_AMOUNT_NOT_POSITIVE: "Le montant doit être supérieur à 0.",
  COUNT_BELOW_ZERO: "L'effectif ne peut pas être négatif.",
  INVALID_SUBJECTS_COUNT: "Le nombre de sujets ne peut pas être négatif.",
  STOCK_QUANTITY_REQUIRED: "Saisissez la quantité.",
  EMPTY_WEIGHING: "Saisissez au moins un poids.",
  FORMULA_NAME_REQUIRED: "Donnez un nom à la formule.",
  FORMULA_PHASE_REQUIRED: "Choisissez la phase visée par la formule.",
  UNKNOWN_VETERINARIAN: "Vétérinaire introuvable.",
  VACCINATION_PROGRAM_NOT_FOUND: "Programme de vaccination introuvable.",
  PLAN_NOT_FOUND: "Ce plan n'est pas disponible.",
  INVALID_PERMISSION: "Permission inconnue.",
  INTERNAL_ERROR: "Une erreur est survenue de notre côté.",
};

/** True when the request never reached the server (offline, DNS, timeout): nothing to read back. */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("status" in error)) return false;
  const status = (error as { status?: unknown }).status;
  return status === "FETCH_ERROR" || status === "TIMEOUT_ERROR";
}

export function parseApiError(error: unknown): ApiError {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "title" in data) {
      return data as ApiError;
    }
  }
  if (isNetworkError(error)) {
    return { type: "network", title: NETWORK_MESSAGE, status: 0, code: "NETWORK_ERROR" };
  }
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "number") {
    return { type: "unknown", title: STATUS_MESSAGES[status] ?? "Une erreur est survenue", status };
  }
  return { type: "unknown", title: "Une erreur est survenue", status: 500 };
}

/**
 * The short reference a user can read out over the phone — the first block of the correlation id
 * the backend already puts in every error response. Short on purpose: it has to survive being
 * dictated on a bad line, and the console search matches on a prefix.
 */
export function apiErrorReference(error: unknown): string | null {
  const traceId = parseApiError(error).traceId;
  return traceId ? traceId.split("-")[0].toUpperCase() : null;
}

/**
 * Short human message: the French sentence for a known code, else the server's `detail`, else its
 * `title`.
 *
 * <p>A server-side failure also carries its reference: those are the errors nobody can act on
 * alone, and the identifier is what turns "it broke this morning" into a request found in
 * /console/traces. A 4xx is the user's own business (a missing field, a refused transition) and
 * stays clean — an incident number there would only be noise.
 */
export function apiErrorMessage(error: unknown): string {
  const parsed = parseApiError(error);
  const message = (parsed.code && CODE_MESSAGES[parsed.code]) || parsed.detail || parsed.title;
  const reference = parsed.status >= 500 ? apiErrorReference(error) : null;
  return reference ? `${message} (réf. ${reference})` : message;
}
