"use client";

import Link from "next/link";
import { Box, Button, Card, CardContent, Skeleton, Typography } from "@mui/material";
import { getCategoryConfig } from "@/constants/catalogCategories";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { CatalogManager } from "./CatalogManager";

const PLACEHOLDER_NAMES: Record<string, string> = {
  stock: "Stock",
  ventes: "Ventes",
};

export function CatalogCategoryView({ slug }: { slug: string }) {
  const config = getCategoryConfig(slug);
  const { farmId, isLoading } = useSelectedFarm();

  if (!config) {
    const name = PLACEHOLDER_NAMES[slug] ?? slug;
    return (
      <Card>
        <CardContent>
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Bientôt disponible
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              La gestion des paramètres « {name} » arrivera dans une prochaine version.
            </Typography>
            <Button component={Link} href="/reglages" variant="outlined">
              Retour aux réglages
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !farmId) {
    return <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 2 }} />;
  }

  return <CatalogManager config={config} farmId={farmId} />;
}
