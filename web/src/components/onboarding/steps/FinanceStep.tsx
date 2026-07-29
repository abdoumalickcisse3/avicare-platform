"use client";

import { Box, CircularProgress } from "@mui/material";
import { colors } from "@/theme/tokens";
import { getCategoryConfig } from "@/constants/catalogCategories";
import { CatalogManager } from "@/components/settings/CatalogManager";
import { useWizard } from "../wizardContext";
import { StepHeader } from "./StepHeader";

/**
 * Finance: manage the seeded expense-category catalog to taste (keep, remove,
 * add your own). Reuses the Réglages catalog manager.
 */
export function FinanceStep() {
  const { farmId } = useWizard();
  const config = getCategoryConfig("comptabilite");

  return (
    <Box>
      <StepHeader
        eyebrow="Étape 6 · Finance"
        title="Configurez vos dépenses"
        subtitle="Gardez les catégories de dépenses qui vous conviennent, retirez les autres, ajoutez les vôtres pour suivre vos coûts."
      />
      {farmId == null || !config ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: colors.primary[500] }} />
        </Box>
      ) : (
        <CatalogManager config={config} farmId={farmId} />
      )}
    </Box>
  );
}
