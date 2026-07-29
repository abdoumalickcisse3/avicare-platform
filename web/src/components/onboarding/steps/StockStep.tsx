"use client";

import { Box, CircularProgress, Stack } from "@mui/material";
import { colors } from "@/theme/tokens";
import { getCategoryConfig } from "@/constants/catalogCategories";
import { CatalogManager } from "@/components/settings/CatalogManager";
import { useWizard } from "../wizardContext";
import { StepHeader } from "./StepHeader";
import { SupplierQuickAdd } from "./QuickAdd";

/**
 * Stock: manage the seeded article catalog to taste (keep, remove, add your
 * own), then optionally register suppliers. Reuses the Réglages catalog manager.
 */
export function StockStep() {
  const { farmId } = useWizard();
  const config = getCategoryConfig("stock");

  return (
    <Box>
      <StepHeader
        eyebrow="Étape 4 · Stock"
        title="Configurez votre stock"
        subtitle="Gardez les articles pré-remplis qui vous conviennent, retirez les autres, ajoutez les vôtres — puis vos fournisseurs."
      />
      {farmId == null || !config ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: colors.primary[500] }} />
        </Box>
      ) : (
        <Stack spacing={2.5}>
          <CatalogManager config={config} farmId={farmId} />
          <SupplierQuickAdd farmId={farmId} />
        </Stack>
      )}
    </Box>
  );
}
