export interface CatalogField {
  name: string;
  label: string;
  kind: 'text' | 'select';
  options?: { value: string; label: string }[];
  const?: string;
}
export interface CategoryConfig {
  slug: 'stock' | 'ventes' | 'comptabilite' | 'creneaux' | 'calibres';
  backendCategory: string;
  title: string;
  labelField: string;
  fields: CatalogField[];
}

// `breeds` n'est volontairement pas ici : une souche se déclare depuis l'écran « Souches », qui
// demande son profil de production. Le gestionnaire générique ne le demandait pas et créait des
// souches sans cible ni courbe — deux écrans pour une même donnée, dont un qui mentait.
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
    slug: 'creneaux',
    backendCategory: 'egg_timeslots',
    title: 'Créneaux de ramassage',
    labelField: 'label',
    fields: [
      { name: 'label', label: 'Nom du créneau', kind: 'text' },
      { name: 'default_time', label: 'Heure indicative', kind: 'text' },
    ],
  },
  {
    slug: 'calibres',
    backendCategory: 'egg_grades',
    title: 'Calibres',
    labelField: 'label',
    fields: [{ name: 'label', label: 'Nom du calibre', kind: 'text' }],
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
