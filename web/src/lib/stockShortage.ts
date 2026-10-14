import { parseApiError } from "./apiError";

/**
 * Un refus « stock insuffisant » (ADR-018), lu depuis la réponse du serveur.
 *
 * <p>Le backend ne se contente pas d'un message : il renvoie l'article et les deux quantités dans
 * les propriétés RFC 7807, précisément pour que l'écran puisse proposer le geste qui débloque —
 * enregistrer l'entrée manquante, ou compter ce qu'il y a — au lieu de laisser l'ouvrier devant
 * un mur.
 */
export interface StockShortage {
  stockItemId: number;
  articleLabel: string;
  unit: string | null;
  available: number;
  requested: number;
}

const CODE = "STOCK_INSUFFICIENT";

function numberOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Le refus, ou `null` si l'erreur est autre chose.
 *
 * <p>Rend `null` aussi quand le refus ne porte pas ses propriétés : ouvrir une fenêtre de
 * réparation vide serait pire que laisser le message passer. Le cas se produit si l'application
 * tourne devant un backend antérieur à ADR-018.
 */
export function stockShortage(error: unknown): StockShortage | null {
  const parsed = parseApiError(error);
  if (parsed.code !== CODE || !parsed.properties) return null;

  const p = parsed.properties;
  const stockItemId = numberOf(p.stockItemId);
  const available = numberOf(p.available);
  const requested = numberOf(p.requested);
  if (stockItemId === null || available === null || requested === null) return null;

  return {
    stockItemId,
    articleLabel: typeof p.articleLabel === "string" ? p.articleLabel : "cet article",
    unit: typeof p.unit === "string" ? p.unit : null,
    available,
    requested,
  };
}

/**
 * Ce qu'il manque pour que la sortie passe.
 *
 * <p>C'est l'écart, pas la quantité demandée : sur une ligne déjà négative il faut d'abord
 * combler le trou. Pré-remplir la demande seule laisserait le solde sous zéro et le geste
 * échouerait une seconde fois.
 */
export function missingQuantity(shortage: Pick<StockShortage, "available" | "requested">): number {
  return shortage.requested - shortage.available;
}
