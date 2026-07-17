import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { colors } from "@/theme/tokens";

interface BrandPanelProps {
  /** Large brand headline rendered in the panel (defaults to the product tagline). */
  tagline?: ReactNode;
  /** Short supporting line under the tagline. */
  caption?: ReactNode;
  /** Background photo behind the Senegal green→yellow gradient overlay. */
  image?: string;
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
  image = "/images/image-eleveur.jpg",
}: BrandPanelProps) {
  // Photo de fond + dégradé Sénégal (vert → jaune/orange) en surimpression
  // semi-transparente. Le vert reste dominant en haut (logo, titre) pour garder
  // le texte blanc lisible ; la chaleur orangée n'arrive qu'en bas. Couleurs via
  // tokens (doc 10) ; jamais de valeur en dur.
  const overlay = `linear-gradient(157deg, ${colors.primary[900]}E6 0%, ${colors.primary[700]}D9 45%, ${colors.primary[500]}B3 72%, ${colors.accent[400]}99 100%)`;

  return (
    <Box
      sx={{
        display: { xs: "none", md: "flex" },
        flexDirection: "column",
        justifyContent: "space-between",
        width: "50%",
        p: 6,
        color: colors.neutral[0],
        backgroundImage: `${overlay}, url(${image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Box
        component="img"
        src="/logo/logo-dark.png"
        alt="AviCare Platform"
        sx={{ height: 60, width: "auto", alignSelf: "flex-start" }}
      />

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
