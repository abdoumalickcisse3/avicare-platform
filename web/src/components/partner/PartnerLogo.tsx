"use client";

import { useState } from "react";
import { Box } from "@mui/material";
import { colors } from "@/theme/tokens";

/**
 * Logo d'un partenaire, avec repli sur son initiale.
 *
 * Deux replis, pas un : l'URL peut être absente (beaucoup de partenaires n'ont
 * pas encore de logo) **et** l'image peut échouer au chargement — un logo hébergé
 * ailleurs peut disparaître sans prévenir, et un carré vide ferait croire à un
 * bug du portail.
 *
 * Partagé entre la carte « Mon réseau » vue par l'éleveur et l'en-tête du
 * portail vu par le partenaire, pour que la même marque s'affiche pareil des
 * deux côtés de la relation.
 */
export function PartnerLogo({
  name,
  logoUrl,
  size = 36,
}: {
  name: string | null | undefined;
  logoUrl: string | null | undefined;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const initial = (name ?? "?").charAt(0).toUpperCase();

  const frame = {
    width: size,
    height: size,
    borderRadius: 1.5,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    bgcolor: colors.primary[50],
    color: colors.primary[600],
  };

  if (!logoUrl || broken) {
    return (
      <Box sx={{ ...frame, fontWeight: 700, fontSize: size * 0.44 }} aria-hidden>
        {initial}
      </Box>
    );
  }

  return (
    <Box sx={frame}>
      <Box
        component="img"
        src={logoUrl}
        alt={name ?? ""}
        onError={() => setBroken(true)}
        sx={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </Box>
  );
}
