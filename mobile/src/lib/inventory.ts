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
