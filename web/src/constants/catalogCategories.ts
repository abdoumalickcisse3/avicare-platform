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

export const CATALOG_CATEGORIES: CategoryConfig[] = [
  {
    slug: "lots",
    backendCategory: "breeds",
    title: "Lots",
    description: "Souches et races de volaille (chair, ponte).",
    labelField: "label",
    fields: [
      { name: "label", label: "Nom", type: "text", required: true },
      {
        name: "type",
        label: "Type",
        type: "select",
        required: true,
        options: [
          { value: "broiler", label: "Chair" },
          { value: "layer", label: "Ponte" },
        ],
      },
      { name: "species", label: "Espèce", type: "text", const: "poultry" },
    ],
  },
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
];

export function getCategoryConfig(slug: string): CategoryConfig | undefined {
  return CATALOG_CATEGORIES.find((c) => c.slug === slug);
}
