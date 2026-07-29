export interface CatalogField {
  name: string;
  label: string;
  kind: 'text' | 'select';
  options?: { value: string; label: string }[];
  const?: string;
}
export interface CategoryConfig {
  slug: 'stock' | 'ventes' | 'comptabilite';
  backendCategory: string;
  title: string;
  labelField: string;
  fields: CatalogField[];
}

export const CATALOG_CATEGORIES: CategoryConfig[] = [
  {
    slug: 'stock',
    backendCategory: 'inventory_items',
    title: 'Stock',
    labelField: 'label',
    fields: [
      { name: 'label', label: "Nom de l'article", kind: 'text' },
      {
        name: 'subcategory',
        label: 'Type',
        kind: 'select',
        options: [
          { value: 'FEED', label: 'Aliment' },
          { value: 'CONSUMABLE', label: 'Consommable' },
          { value: 'EQUIPMENT', label: 'Équipement' },
          { value: 'PRODUCT', label: 'Produit' },
        ],
      },
      { name: 'unit', label: 'Unité', kind: 'text' },
    ],
  },
  {
    slug: 'ventes',
    backendCategory: 'sales_channels',
    title: 'Circuits de vente',
    labelField: 'label',
    fields: [{ name: 'label', label: 'Nom du circuit', kind: 'text' }],
  },
  {
    slug: 'comptabilite',
    backendCategory: 'expense_categories',
    title: 'Catégories de dépenses',
    labelField: 'label',
    fields: [{ name: 'label', label: 'Libellé', kind: 'text' }],
  },
];

export function getCategoryConfig(slug: string): CategoryConfig | undefined {
  return CATALOG_CATEGORIES.find((c) => c.slug === slug);
}
