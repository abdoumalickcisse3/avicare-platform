import { CATALOG_CATEGORIES, getCategoryConfig } from '../catalogCategories';

describe('getCategoryConfig', () => {
  // Le gestionnaire générique écrivait dans `breeds` sans demander le profil de production :
  // il créait des souches sans cible ni courbe, pendant que l'écran « Souches » faisait le vrai
  // travail juste à côté. Un seul des deux peut dire la vérité.
  it("aucune catégorie n'écrit dans breeds", () => {
    expect(CATALOG_CATEGORIES.map((c) => c.backendCategory)).not.toContain('breeds');
  });
  it("le slug lots n'existe plus", () => {
    expect(getCategoryConfig('lots')).toBeUndefined();
  });
  it('maps slugs to backend categories', () => {
    expect(getCategoryConfig('stock')?.backendCategory).toBe('inventory_items');
    expect(getCategoryConfig('ventes')?.backendCategory).toBe('sales_channels');
    expect(getCategoryConfig('comptabilite')?.backendCategory).toBe('expense_categories');
  });
  it('returns undefined for unknown slugs', () => {
    expect(getCategoryConfig('nope')).toBeUndefined();
  });
  it('stock has a subcategory select', () => {
    const stock = getCategoryConfig('stock')!;
    const sub = stock.fields.find((f) => f.name === 'subcategory');
    expect(sub?.kind).toBe('select');
    expect(sub?.options?.map((o) => o.value)).toEqual(['FEED', 'CONSUMABLE', 'EQUIPMENT', 'PRODUCT']);
  });
});
