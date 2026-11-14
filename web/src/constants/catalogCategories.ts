export interface FieldDescriptor {
  name: string;
  label: string;
  type: "text" | "select" | "number";
  required?: boolean;
  options?: { value: string; label: string }[];
  /** Fixed value injected into the entry value, not shown in the form. */
  const?: string;
}

export interface CategoryConfig {
  slug: string;
  backendCategory: string;
  title: string;
  description: string;
  labelField: string;
  fields: FieldDescriptor[];
}

// `breeds` n'est volontairement pas ici : une souche se déclare depuis /reglages/souches, qui
// demande son profil de production. Le gestionnaire générique ne le demandait pas et créait des
// souches sans cible ni courbe — deux écrans pour une même donnée, dont un qui mentait.
export const CATALOG_CATEGORIES: CategoryConfig[] = [
  {
    slug: "comptabilite",
    backendCategory: "expense_categories",
    title: "Comptabilité",
    description: "Catégories de dépenses.",
    labelField: "label",
    fields: [{ name: "label", label: "Libellé", type: "text", required: true }],
  },
  {
    slug: "stock",
    backendCategory: "inventory_items",
    title: "Stock",
    description: "Articles de stock : aliments, consommables, équipements, produits.",
    labelField: "label",
    fields: [
      { name: "label", label: "Nom de l'article", type: "text", required: true },
      {
        name: "subcategory",
        label: "Type",
        type: "select",
        required: true,
        options: [
          { value: "FEED", label: "Aliment" },
          { value: "CONSUMABLE", label: "Consommable" },
          { value: "EQUIPMENT", label: "Équipement" },
          { value: "PRODUCT", label: "Produit" },
        ],
      },
      { name: "unit", label: "Unité (kg, sac, L…)", type: "text", required: true },
      { name: "typical_unit_price_xof", label: "Prix indicatif (F CFA)", type: "number" },
    ],
  },
  {
    slug: "ventes",
    backendCategory: "sales_channels",
    title: "Ventes",
    description: "Circuits de distribution : détail, grossiste, restaurant, marché, coopérative.",
    labelField: "label",
    fields: [{ name: "label", label: "Nom du circuit", type: "text", required: true }],
  },
];

export function getCategoryConfig(slug: string): CategoryConfig | undefined {
  return CATALOG_CATEGORIES.find((c) => c.slug === slug);
}
