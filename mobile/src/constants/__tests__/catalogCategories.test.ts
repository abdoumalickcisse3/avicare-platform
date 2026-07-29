import { getCategoryConfig } from '../catalogCategories';

describe('getCategoryConfig', () => {
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
