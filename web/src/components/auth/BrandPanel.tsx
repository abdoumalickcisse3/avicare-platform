import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Egg } from "lucide-react";
import { colors } from "@/theme/tokens";

interface BrandPanelProps {
  /** Large brand headline rendered in the panel (defaults to the product tagline). */
  tagline?: ReactNode;
  /** Short supporting line under the tagline. */
  caption?: ReactNode;
}

/**
 * Reusable branded panel for the split-screen auth layout (login / signup /
 * forgot-password). Deep-green gradient (primary-800 → primary-500, doc 10 §2),
 * logo tile and tagline. Hidden below md — the form column stands alone on
 * mobile. Inspiration: Stitch "Avicare Design System" auth screens; rebuilt in
 * MUI with theme tokens (no hardcoded colors).
 */
export function BrandPanel({
  tagline = (
    <>
      L&apos;élevage avicole maîtrisé,
      <br />
      du Sénégal au monde.
    </>
  ),
  caption = "Pilotez vos bandes, vos coûts et vos performances depuis une seule plateforme pensée pour l'Afrique de l'Ouest.",
}: BrandPanelProps) {
  return (
    <Box
      sx={{
        display: { xs: "none", md: "flex" },
        flexDirection: "column",
        justifyContent: "space-between",
        width: "50%",
        p: 6,
        color: colors.neutral[0],
        background: `linear-gradient(160deg, ${colors.primary[800]} 0%, ${colors.primary[500]} 100%)`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Egg size={24} strokeWidth={1.75} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          AviCare
        </Typography>
      </Box>

      <Stack spacing={2} sx={{ maxWidth: 460 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
          {tagline}
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.85 }}>
          {caption}
        </Typography>
      </Stack>

      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        © {new Date().getFullYear()} AviCare Platform · Dakar, Sénégal
      </Typography>
    </Box>
  );
}
