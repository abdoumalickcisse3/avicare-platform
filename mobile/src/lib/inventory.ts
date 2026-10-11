/** Inventory display helpers, ported from the web `lib/inventory.ts`. */
import type { ArticleSource, FeedPhase } from '@/types';

export const ARTICLE_SOURCE_LABELS: Record<ArticleSource, string> = {
  INVENTORY: 'Article',
  TREATMENT: 'Médicament',
  PRODUCTION: 'Production',
};

/** FR labels for inventory article subcategories. */
export const INVENTORY_SUBCATEGORY_LABELS: Record<string, string> = {
  FEED: 'Aliment',
  CONSUMABLE: 'Consommable',
  EQUIPMENT: 'Équipement',
  PRODUCT: 'Produit',
};

export const FEED_PHASE_LABELS: Record<FeedPhase, string> = {
  STARTER: 'Démarrage',
  GROWER: 'Croissance',
  FINISHER: 'Finition',
  PRE_LAYER: 'Pré-ponte',
  LAYER: 'Ponte',
  BREEDER: 'Reproducteur',
  OTHER: 'Autre',
};

/** Human label for a subcategory key (falls back to the raw key). */
export function subcategoryLabel(key: string): string {
  return INVENTORY_SUBCATEGORY_LABELS[key] ?? key;
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
  const readable = key.replace(/[_-]+/g, ' ').trim();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}
