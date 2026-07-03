import Link from "next/link";
import { Box, Breadcrumbs, Typography } from "@mui/material";
import { getCategoryConfig } from "@/constants/catalogCategories";
import { CatalogCategoryView } from "@/components/settings/CatalogCategoryView";

const CATEGORY_NAMES: Record<string, string> = {
  stock: "Stock",
  lots: "Lots",
  sanitaire: "Sanitaire",
  ventes: "Ventes",
  comptabilite: "Comptabilité",
};

/** Settings category page: renders the generic catalog manager for configured slugs. */
export default async function SettingsCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const name = getCategoryConfig(category)?.title ?? CATEGORY_NAMES[category] ?? category;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link href="/reglages" style={{ color: "inherit" }}>
          Réglages
        </Link>
        <Typography color="text.primary">{name}</Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        {name}
      </Typography>

      <CatalogCategoryView slug={category} />
    </Box>
  );
}
