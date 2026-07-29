"use client";

import { Box, Button, Dialog, Stack, Typography } from "@mui/material";
import { colors, radii, shadows } from "@/theme/tokens";

/**
 * First-run welcome popup (Stitch "Modale de Bienvenue"). Deliberately simple —
 * one warm illustration, a greeting, and a single "Commencer" CTA that launches
 * the guided dashboard tour. "Passer la visite" opts out. The dashboard behind
 * is blurred (glassmorphism) via the backdrop.
 */
export function WelcomeModal({
  open,
  onStart,
  onSkip,
}: {
  open: boolean;
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onSkip}
      slotProps={{
        paper: {
          sx: {
            width: "100%",
            maxWidth: 460,
            m: 2,
            borderRadius: `${radii.xl}px`,
            overflow: "hidden",
            boxShadow: shadows.xl,
          },
        },
        backdrop: {
          sx: {
            backgroundColor: "rgba(18, 43, 18, 0.45)",
            backdropFilter: "blur(6px)",
          },
        },
      }}
    >
      <FarmIllustration />

      <Stack spacing={2} sx={{ px: { xs: 3, sm: 4 }, pt: 3, pb: 4, textAlign: "center" }}>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: "-0.02em",
            color: colors.neutral[800],
          }}
        >
          Bienvenue sur Jawdi
        </Typography>
        <Typography sx={{ fontSize: 15.5, color: colors.neutral[500], px: { sm: 1 } }}>
          Votre ferme est prête. On vous montre l&apos;essentiel en 30 secondes.
        </Typography>

        <Button
          onClick={onStart}
          fullWidth
          sx={{
            mt: 1,
            height: 50,
            bgcolor: colors.accent[400],
            color: colors.neutral[0],
            fontWeight: 700,
            fontSize: 16,
            borderRadius: `${radii.lg}px`,
            boxShadow: shadows.sm,
            "&:hover": { bgcolor: colors.accent[500] },
          }}
        >
          Commencer
        </Button>
        <Button
          onClick={onSkip}
          sx={{
            color: colors.neutral[500],
            fontWeight: 600,
            "&:hover": { bgcolor: colors.neutral[100] },
          }}
        >
          Passer la visite
        </Button>
      </Stack>
    </Dialog>
  );
}

/** Warm, on-brand hero band — inline SVG so the modal is fully self-contained. */
function FarmIllustration() {
  return (
    <Box
      sx={{
        height: 190,
        background: `linear-gradient(160deg, ${colors.primary[400]} 0%, ${colors.primary[700]} 100%)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 460 190"
        sx={{ width: "100%", height: "100%", display: "block" }}
        aria-hidden
      >
        {/* Sun */}
        <circle cx="360" cy="58" r="34" fill={colors.accent[300]} opacity="0.9" />
        <circle cx="360" cy="58" r="34" fill={colors.accent[400]} opacity="0.35" />
        {/* Rolling ground */}
        <path d="M0 150 Q115 118 230 150 T460 150 L460 190 L0 190 Z" fill={colors.primary[800]} opacity="0.55" />
        <path d="M0 165 Q140 140 280 165 T460 160 L460 190 L0 190 Z" fill={colors.primary[900]} opacity="0.6" />
        {/* Simple hen silhouette */}
        <g transform="translate(150 96)" fill={colors.neutral[0]}>
          <ellipse cx="40" cy="40" rx="42" ry="30" opacity="0.96" />
          <circle cx="76" cy="20" r="16" opacity="0.96" />
          <path d="M76 6 q6 -12 14 -6 q-2 8 -8 12 Z" fill={colors.accent[400]} />
          <path d="M90 22 l12 -2 -8 8 Z" fill={colors.accent[400]} />
          <circle cx="80" cy="18" r="2.4" fill={colors.neutral[800]} />
          <path d="M4 48 q-14 6 -6 18 q10 -4 14 -12 Z" opacity="0.9" />
        </g>
      </Box>
    </Box>
  );
}
