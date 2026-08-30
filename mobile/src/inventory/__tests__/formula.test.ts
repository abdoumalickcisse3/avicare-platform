import {
  addIngredient,
  estimatedCostPer100kg,
  normaliseTo100,
  percentageGap,
  phaseLabel,
  removeIngredient,
  setPercentage,
  totalPercentage,
} from '../formula';
import type { FormulaIngredient, InventoryCatalogItem } from '@/types';

const ing = (articleKey: string, percentage: number): FormulaIngredient => ({
  articleKey,
  articleSource: 'INVENTORY',
  percentage,
});

const article = (articleKey: string, typicalUnitPriceXof: number | null): InventoryCatalogItem => ({
  articleKey,
  articleSource: 'INVENTORY',
  label: articleKey,
  subcategory: null,
  unit: 'kg',
  typicalUnitPriceXof,
  custom: false,
});

describe('totalPercentage', () => {
  it('rounds away float noise', () => {
    // 0.1 + 0.2 arithmetic would otherwise surface as 99.99999999 in the UI.
    expect(totalPercentage([ing('a', 33.33), ing('b', 33.33), ing('c', 33.34)])).toBe(100);
  });

  it('treats a missing share as zero rather than NaN', () => {
    expect(totalPercentage([ing('a', Number.NaN), ing('b', 40)])).toBe(40);
  });
});

describe('percentageGap', () => {
  it('is negative when the formula is short and positive when it is over', () => {
    expect(percentageGap([ing('a', 96)])).toBe(-4);
    expect(percentageGap([ing('a', 104)])).toBe(4);
  });
});

describe('estimatedCostPer100kg', () => {
  it('multiplies each share by its price, since a share is also its kilograms', () => {
    // 60 kg at 300 + 40 kg at 500 = 18 000 + 20 000.
    const cost = estimatedCostPer100kg(
      [ing('mais', 60), ing('tourteau', 40)],
      [article('mais', 300), article('tourteau', 500)],
    );
    expect(cost).toBe(38000);
  });

  it('returns null when one ingredient has no price', () => {
    // A partial sum would read as a cheap formula, and that is the number feed gets priced on.
    expect(
      estimatedCostPer100kg([ing('mais', 60), ing('x', 40)], [article('mais', 300), article('x', null)]),
    ).toBeNull();
  });

  it('returns null for an empty formula rather than zero', () => {
    expect(estimatedCostPer100kg([], [])).toBeNull();
  });
});

describe('addIngredient', () => {
  it('refuses a second line for the same article', () => {
    const list = [ing('mais', 60)];
    expect(addIngredient(list, 'mais')).toBe(list);
  });

  it('adds a new article at zero, so the total does not jump', () => {
    expect(addIngredient([], 'mais')).toEqual([ing('mais', 0)]);
  });
});

describe('setPercentage', () => {
  it('clamps to the 0–100 the backend validates each line against', () => {
    expect(setPercentage([ing('a', 10)], 'a', 140)[0]?.percentage).toBe(100);
    expect(setPercentage([ing('a', 10)], 'a', -5)[0]?.percentage).toBe(0);
  });

  it('touches only the line it names', () => {
    const out = setPercentage([ing('a', 10), ing('b', 20)], 'a', 50);
    expect(out.map((i) => i.percentage)).toEqual([50, 20]);
  });
});

describe('removeIngredient', () => {
  it('drops the line', () => {
    expect(removeIngredient([ing('a', 10), ing('b', 20)], 'a')).toEqual([ing('b', 20)]);
  });
});

describe('normaliseTo100', () => {
  it('scales a short formula up to exactly 100', () => {
    const out = normaliseTo100([ing('a', 48), ing('b', 48)]);
    expect(totalPercentage(out)).toBe(100);
  });

  it('scales an over-100 formula back down', () => {
    const out = normaliseTo100([ing('a', 70), ing('b', 60)]);
    expect(totalPercentage(out)).toBe(100);
  });

  it('lands on exactly 100 even when the scaling leaves rounding drift', () => {
    const out = normaliseTo100([ing('a', 33), ing('b', 33), ing('c', 33)]);
    expect(totalPercentage(out)).toBe(100);
  });

  it('leaves an all-zero formula alone rather than dividing by zero', () => {
    const list = [ing('a', 0)];
    expect(normaliseTo100(list)).toBe(list);
  });
});

describe('phaseLabel', () => {
  it('translates the phase the farmer chooses from', () => {
    expect(phaseLabel('PRE_LAYER')).toBe('Pré-ponte');
  });

  it('falls back to the raw value for a phase added later', () => {
    expect(phaseLabel('MYSTERY')).toBe('MYSTERY');
  });
});
