"use client";

import { Box, CircularProgress, Stack } from "@mui/material";
import { colors } from "@/theme/tokens";
import { getCategoryConfig } from "@/constants/catalogCategories";
import { CatalogManager } from "@/components/settings/CatalogManager";
import { useWizard } from "../wizardContext";
import { StepHeader } from "./StepHeader";
import { ClientQuickAdd } from "./QuickAdd";

/**
 * Commercial: manage the seeded sales-channel catalog to taste, then register
 * first clients. Reuses the Réglages catalog manager.
 */
export function CommercialStep() {
  const { farmId } = useWizard();
  const config = getCategoryConfig("ventes");

  return (
    <Box>
      <StepHeader
        eyebrow="Étape 5 · Commercial"
        title="Configurez votre commercial"
        subtitle="Gardez les circuits de vente pré-remplis qui vous conviennent, ajoutez les vôtres — puis enregistrez vos premiers clients."
      />
      {farmId == null || !config ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: colors.primary[500] }} />
        </Box>
      ) : (
        <Stack spacing={2.5}>
          <CatalogManager config={config} farmId={farmId} />
          <ClientQuickAdd farmId={farmId} />
        </Stack>
      )}
    </Box>
  );
}
