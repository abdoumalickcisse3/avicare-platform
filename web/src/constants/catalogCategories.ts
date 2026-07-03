export interface FieldDescriptor {
  name: string;
  label: string;
  type: "text" | "select";
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
];

export function getCategoryConfig(slug: string): CategoryConfig | undefined {
  return CATALOG_CATEGORIES.find((c) => c.slug === slug);
}
