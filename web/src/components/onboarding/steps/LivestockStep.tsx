"use client";

import { useMemo } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { Bird, Egg, Info } from "lucide-react";
import { colors, radii } from "@/theme/tokens";
import { useGetBreedsQuery } from "@/store/api/breedsApi";
import { useGetMyFarmsQuery } from "@/store/api/farmsApi";
import { useWizard } from "../wizardContext";
import { StepHeader } from "./StepHeader";

/** Élevage: shows the breeds available to the farm's focus (platform reference,
 * seeded). Read-only review — lots are created later from the Élevage menu. */
export function LivestockStep() {
  const { farmId } = useWizard();
  const { data: breeds, isLoading } = useGetBreedsQuery({ species: "POULTRY" });
  const { data: farms } = useGetMyFarmsQuery();

  const focusTokens = useMemo(
    () => farms?.find((f) => f.id === farmId)?.productionFocus ?? ["broiler", "layer"],
    [farms, farmId],
  );

  const shown = useMemo(
    () =>
      (breeds ?? []).filter(
        (b) => b.type == null || focusTokens.includes(b.type),
      ),
    [breeds, focusTokens],
  );

  return (
    <Box>
      <StepHeader
        eyebrow="Étape 3 · Élevage"
        title="Vos races sont prêtes"
        subtitle="Voici les souches disponibles pour votre type de production. Vous créerez votre premier lot depuis le menu Élevage."
      />

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: colors.primary[500] }} />
        </Box>
      ) : shown.length === 0 ? (
        <EmptyHint text="Aucune race pré-remplie. Vous en ajouterez dans Réglages › Lots." />
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          {shown.map((b) => {
            const layer = b.type === "layer";
            const Icon = layer ? Egg : Bird;
            return (
              <Box
                key={b.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 2,
                  bgcolor: colors.neutral[0],
                  border: `1px solid ${colors.neutral[200]}`,
                  borderRadius: radii.lg,
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: radii.md,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: layer ? colors.accent[50] : colors.primary[50],
                    color: layer ? colors.accent[500] : colors.primary[600],
                  }}
                >
                  <Icon size={20} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, color: colors.neutral[800] }}>
                    {b.name}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: colors.neutral[500] }}>
                    {layer ? "Ponte" : b.type === "broiler" ? "Chair" : "Volaille"}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: "flex-start",
        p: 2,
        bgcolor: colors.info.light,
        borderRadius: radii.lg,
      }}
    >
      <Box sx={{ color: colors.info.main, mt: "2px" }}>
        <Info size={18} />
      </Box>
      <Typography sx={{ fontSize: 14, color: colors.neutral[700] }}>{text}</Typography>
    </Stack>
  );
}
