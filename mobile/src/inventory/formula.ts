/**
 * Feed-formula arithmetic.
 *
 * The one rule that shapes the editor: the backend treats a total percentage other than 100 as a
 * **non-blocking warning**. A formula can be saved half-composed and finished tomorrow. So the
 * editor reports the gap, never refuses on it — the same posture as the withdrawal delay.
 *
 * A percentage is also a weight: an ingredient at 35 % is 35 kg in 100 kg. That is what makes the
 * cost computable locally — `Σ percentage × unit price` — and it is worth showing live, because
 * the reason to compose a formula at all is to land on a price per 100 kg.
 */
import type { FormulaIngredient, InventoryCatalogItem } from '@/types';

export const FEED_PHASE_LABELS: Record<string, string> = {
  STARTER: 'Démarrage',
  GROWER: 'Croissance',
  FINISHER: 'Finition',
  PRE_LAYER: 'Pré-ponte',
  LAYER: 'Ponte',
  BREEDER: 'Reproducteur',
  OTHER: 'Autre',
};

export function phaseLabel(phase: string): string {
  return FEED_PHASE_LABELS[phase] ?? phase;
}

/** Sum of the ingredient shares, rounded to two decimals to avoid float noise like 99.99999. */
export function totalPercentage(ingredients: FormulaIngredient[]): number {
  const sum = ingredients.reduce((acc, i) => acc + (Number.isFinite(i.percentage) ? i.percentage : 0), 0);
  return Math.round(sum * 100) / 100;
}

/** Signed distance from 100 %: positive means over, negative means short. */
export function percentageGap(ingredients: FormulaIngredient[]): number {
  return Math.round((totalPercentage(ingredients) - 100) * 100) / 100;
}

/**
 * Cost of 100 kg at current catalog prices, or null when a priced ingredient is missing one.
 *
 * Null rather than a partial sum: a formula costed from half its ingredients would read as
 * cheap, and that is the number a farmer would price their feed on.
 */
export function estimatedCostPer100kg(
  ingredients: FormulaIngredient[],
  articles: InventoryCatalogItem[],
): number | null {
  if (ingredients.length === 0) return null;
  const priceByKey = new Map(articles.map((a) => [a.articleKey, a.typicalUnitPriceXof]));
  let total = 0;
  for (const ingredient of ingredients) {
    const price = priceByKey.get(ingredient.articleKey);
    if (price == null) return null;
    total += ingredient.percentage * price;
  }
  return Math.round(total);
}

/** Adds an article, or tops up the line that already holds it — never a second row for one key. */
export function addIngredient(
  ingredients: FormulaIngredient[],
  articleKey: string,
): FormulaIngredient[] {
  if (ingredients.some((i) => i.articleKey === articleKey)) return ingredients;
  return [...ingredients, { articleKey, articleSource: 'INVENTORY', percentage: 0 }];
}

/** Clamps to the 0–100 the backend validates each line against. */
export function setPercentage(
  ingredients: FormulaIngredient[],
  articleKey: string,
  percentage: number,
): FormulaIngredient[] {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(percentage) ? percentage : 0));
  return ingredients.map((i) => (i.articleKey === articleKey ? { ...i, percentage: clamped } : i));
}

export function removeIngredient(
  ingredients: FormulaIngredient[],
  articleKey: string,
): FormulaIngredient[] {
  return ingredients.filter((i) => i.articleKey !== articleKey);
}

/**
 * Spread the missing (or excess) share over the ingredients proportionally, so one tap finishes
 * a formula that is at 96 %. Returns the list untouched when it is already at 100, or when every
 * share is zero and there is nothing to scale.
 */
export function normaliseTo100(ingredients: FormulaIngredient[]): FormulaIngredient[] {
  const total = totalPercentage(ingredients);
  if (total === 100 || total <= 0) return ingredients;
  const factor = 100 / total;
  const scaled = ingredients.map((i) => ({
    ...i,
    percentage: Math.round(i.percentage * factor * 100) / 100,
  }));
  // Rounding can leave a cent of drift; give it to the largest line, where it is invisible.
  const drift = Math.round((100 - totalPercentage(scaled)) * 100) / 100;
  if (drift === 0 || scaled.length === 0) return scaled;
  let largest = 0;
  for (let i = 1; i < scaled.length; i += 1) {
    if ((scaled[i]?.percentage ?? 0) > (scaled[largest]?.percentage ?? 0)) largest = i;
  }
  return scaled.map((i, index) =>
    index === largest ? { ...i, percentage: Math.round((i.percentage + drift) * 100) / 100 } : i,
  );
}
