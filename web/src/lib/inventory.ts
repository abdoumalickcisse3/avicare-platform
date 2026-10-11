import type {
  ArticleSource,
  FeedPhase,
  MovementReason,
  MovementType,
  PurchaseOrderStatus,
  StockItem,
} from "@/types";
import { colors } from "@/theme/tokens";

/** Human labels (FR) for the inventory enums. */
export const MOVEMENT_REASON_LABELS: Record<MovementReason, string> = {
  RECEPTION_PURCHASE: "Réception achat",
  GIFT: "Don",
  RETURN_SUPPLIER: "Retour fournisseur",
  CONSUMPTION_LOT: "Consommation lot",
  CONSUMPTION_VACCINATION: "Consommation vaccination",
  CONSUMPTION_TREATMENT: "Consommation traitement",
  LOSS: "Perte",
  SALE: "Vente",
  THEFT: "Vol",
  INVENTORY_PHYSICAL: "Inventaire physique",
  ERROR_CORRECTION: "Correction d'erreur",
};

/** Reasons offered for a manual entry, grouped by movement direction. */
export const REASONS_BY_TYPE: Record<MovementType, MovementReason[]> = {
  IN: ["RECEPTION_PURCHASE", "GIFT", "RETURN_SUPPLIER"],
  OUT: ["CONSUMPTION_LOT", "LOSS", "SALE", "THEFT"],
  ADJUSTMENT: ["INVENTORY_PHYSICAL", "ERROR_CORRECTION"],
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  IN: "Entrée",
  OUT: "Sortie",
  ADJUSTMENT: "Ajustement",
};

export const FEED_PHASE_LABELS: Record<FeedPhase, string> = {
  STARTER: "Démarrage",
  GROWER: "Croissance",
  FINISHER: "Finition",
  PRE_LAYER: "Pré-ponte",
  LAYER: "Ponte",
  BREEDER: "Reproducteur",
  OTHER: "Autre",
};

export const ARTICLE_SOURCE_LABELS: Record<ArticleSource, string> = {
  INVENTORY: "Article",
  TREATMENT: "Médicament",
  PRODUCTION: "Production",
};

/** FR labels for inventory article subcategories. */
export const INVENTORY_SUBCATEGORY_LABELS: Record<string, string> = {
  FEED: "Aliment",
  CONSUMABLE: "Consommable",
  EQUIPMENT: "Équipement",
  PRODUCT: "Produit",
};

interface BadgeMeta {
  label: string;
  bg: string;
  fg: string;
}

export const PO_STATUS_META: Record<PurchaseOrderStatus, BadgeMeta> = {
  DRAFT: { label: "Brouillon", bg: colors.neutral[200], fg: colors.neutral[700] },
  SENT: { label: "Envoyé", bg: colors.warning.light, fg: colors.warning.dark },
  RECEIVED: { label: "Reçu", bg: colors.success.light, fg: colors.success.dark },
  CANCELLED: { label: "Annulé", bg: colors.error.light, fg: colors.error.dark },
};

export type StockState = "NEGATIVE" | "CRITIQUE" | "BAS" | "OK";

/**
 * Stock health relative to the alert threshold (Décision 19 — negative is a
 * non-blocking warning). CRITIQUE at/below half the threshold, BAS at/below it.
 */
export function stockState(item: {
  currentQuantity: number;
  alertThreshold: number | null;
}): StockState {
  if (item.currentQuantity < 0) return "NEGATIVE";
  const t = item.alertThreshold;
  if (t == null || t <= 0) return "OK";
  if (item.currentQuantity <= t * 0.5) return "CRITIQUE";
  if (item.currentQuantity <= t) return "BAS";
  return "OK";
}

export const STOCK_STATE_META: Record<StockState, BadgeMeta> = {
  NEGATIVE: { label: "Négatif", bg: colors.error.light, fg: colors.error.dark },
  CRITIQUE: { label: "Critique", bg: colors.error.light, fg: colors.error.dark },
  BAS: { label: "Stock bas", bg: colors.warning.light, fg: colors.warning.dark },
  OK: { label: "OK", bg: colors.success.light, fg: colors.success.dark },
};

/** Quantity with its unit (mono tabular-nums is applied by the caller). */
export function formatQty(n: number, unit: string | null | undefined): string {
  const v = new Intl.NumberFormat("fr-SN", { maximumFractionDigits: 2 }).format(n);
  return unit ? `${v} ${unit}` : v;
}

/** Total OUT quantity over the last {@code days} days (consumption metric). */
export function consumptionInLastDays(
  movements: { movementType: MovementType; movementDate: string; quantity: number }[],
  days: number,
): number {
  const cutoff = Date.now() - days * 86_400_000;
  return movements
    .filter((m) => m.movementType === "OUT" && new Date(m.movementDate).getTime() >= cutoff)
    .reduce((s, m) => s + m.quantity, 0);
}

/** Resolve a stock item for a catalog article key (for the coupling helper). */
export function findStockByArticle(
  items: StockItem[] | undefined,
  articleKey: string,
): StockItem | undefined {
  return items?.find((s) => s.articleKey === articleKey && s.active);
}

/**
 * Le nom qu'un éleveur reconnaît, pour une clé d'article.
 *
 * Une ligne de stock ne porte que sa clé ; le libellé est résolu à la lecture. Les clés de la
 * plateforme sont en anglais (`corn_crushed`, `feed_starter_broiler`) parce qu'elles sont des
 * identifiants, pas du texte — le catalogue en porte la traduction (« Maïs concassé »,
 * « Démarrage poulet chair »). Afficher la clé telle quelle, c'est montrer de l'anglais à
 * quelqu'un qui a tout écrit en français : c'est ce que faisaient l'aperçu d'un modèle de
 * formule et le dialogue du seuil.
 *
 * Repli : la clé rendue lisible. Un article personnalisé a une clé déjà française
 * (`vaccin-gumboro-1` → « Vaccin gumboro 1 »), donc le repli reste correct pour lui ; il n'est
 * fautif que pour un article de la plateforme absent de la liste, ce qui ne devrait pas arriver.
 */
export function articleLabelFor(
  key: string,
  articles: { articleKey: string; label: string | null }[] | undefined,
): string {
  const found = articles?.find((a) => a.articleKey === key)?.label;
  if (found) return found;
  const readable = key.replace(/[_-]+/g, " ").trim();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}
