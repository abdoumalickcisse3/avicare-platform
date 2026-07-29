"use client";

import { Box, Stack, Typography } from "@mui/material";
import { Bird, Boxes, LineChart, Wallet } from "lucide-react";
import { colors, radii } from "@/theme/tokens";
import { StepHeader } from "./StepHeader";

const MODULES = [
  { icon: Bird, label: "Élevage", hint: "Lots, saisies, mortalité" },
  { icon: Boxes, label: "Stock", hint: "Aliments, alertes de seuil" },
  { icon: LineChart, label: "Commercial", hint: "Ventes, clients, factures" },
  { icon: Wallet, label: "Finance", hint: "Dépenses, résultat" },
] as const;

/** First panel: sets expectations. No persistence — just orient and reassure. */
export function WelcomeStep() {
  return (
    <Box>
      <StepHeader
        eyebrow="Bienvenue"
        title="On configure votre ferme ensemble"
        subtitle="Quelques réglages rapides et vous pilotez votre élevage en entier. Tout est déjà pré-rempli — vous n'avez qu'à valider."
      />

      <Stack spacing={1.5}>
        {MODULES.map(({ icon: Icon, label, hint }) => (
          <Box
            key={label}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              p: 2,
              bgcolor: colors.neutral[0],
              border: `1px solid ${colors.neutral[200]}`,
              borderRadius: radii.lg,
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: radii.md,
                bgcolor: colors.primary[50],
                color: colors.primary[600],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={22} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, color: colors.neutral[800] }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: 14, color: colors.neutral[500] }}>
                {hint}
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
