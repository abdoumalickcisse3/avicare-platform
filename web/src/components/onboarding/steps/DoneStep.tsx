"use client";

import { Box, Stack, Typography } from "@mui/material";
import { Check, Sparkles } from "lucide-react";
import { colors, radii } from "@/theme/tokens";

const NEXT = [
  "Créez votre premier lot dans Élevage",
  "Enregistrez vos premières entrées de stock",
  "Invitez vos membres depuis Réglages",
] as const;

/** Closing panel. The footer CTA takes over from here (sets the welcome flag,
 * routes to the dashboard). */
export function DoneStep() {
  return (
    <Box sx={{ textAlign: "center", pt: { xs: 2, md: 4 } }}>
      <Box
        sx={{
          width: 84,
          height: 84,
          mx: "auto",
          mb: 3,
          borderRadius: radii.full,
          bgcolor: colors.primary[50],
          color: colors.primary[600],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 0 8px ${colors.primary[50]}88`,
        }}
      >
        <Sparkles size={38} />
      </Box>

      <Typography
        sx={{
          fontWeight: 800,
          fontSize: { xs: 28, md: 34 },
          letterSpacing: "-0.02em",
          color: colors.neutral[800],
        }}
      >
        Votre ferme est prête
      </Typography>
      <Typography sx={{ fontSize: 16, color: colors.neutral[500], mt: 1, mb: 4 }}>
        Tout est configuré. On vous montre l&apos;essentiel sur le tableau de bord.
      </Typography>

      <Stack spacing={1.25} sx={{ maxWidth: 380, mx: "auto", textAlign: "left" }}>
        {NEXT.map((t) => (
          <Box
            key={t}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: 1.75,
              bgcolor: colors.neutral[0],
              border: `1px solid ${colors.neutral[200]}`,
              borderRadius: radii.lg,
            }}
          >
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: radii.full,
                bgcolor: colors.success.light,
                color: colors.success.dark,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Check size={15} />
            </Box>
            <Typography sx={{ fontSize: 14.5, color: colors.neutral[700] }}>{t}</Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
