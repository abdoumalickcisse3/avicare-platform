"use client";

/**
 * The floating way into Jawdi — a person, with a name, on every dashboard page.
 *
 * Until now the advisor lived in one sidebar line between "Tableau de bord" and "Fermes": a
 * `Sparkles` icon and two words, as discoverable as a settings entry. The mobile app made the
 * entry point a face; the web gets the same one, so the advisor is the same someone on both.
 *
 * It hides in exactly two places: on `/assistant`, where you are already talking to him, and on
 * the print views, which must carry no app chrome at all. It is deliberately NOT gated — the
 * sidebar entry never was, and the backend remains the real guard on what Jawdi will answer.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { colors } from "@/theme/tokens";
import { JawdiFace } from "./JawdiFace";

export function JawdiFab() {
  const pathname = usePathname();

  // You don't call someone who is already on the line.
  if (pathname?.startsWith("/assistant")) return null;
  // The invoice must stand alone — same rule as the commercial FAB.
  if (pathname?.endsWith("/imprimer")) return null;

  return (
    <Box
      component={Link}
      href="/assistant"
      aria-label="Parler à Jawdi IA, votre conseiller d’élevage"
      data-app-chrome
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: (t) => t.zIndex.speedDial,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        pl: 1,
        pr: 2.5,
        py: 1,
        borderRadius: 999,
        textDecoration: "none",
        background: `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[700]})`,
        boxShadow: "0 6px 20px rgba(28,25,23,0.30)",
        transition: "transform 140ms ease, box-shadow 140ms ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: "0 10px 26px rgba(28,25,23,0.34)" },
        "&:active": { transform: "scale(0.98)" },
      }}
    >
      <JawdiFace size={46} />
      <Box sx={{ whiteSpace: "nowrap" }}>
        <Typography sx={{ color: "#fff", fontWeight: 600, fontSize: 16, lineHeight: 1.3 }}>
          Jawdi IA
        </Typography>
        <Typography sx={{ color: colors.primary[100], fontSize: 12.5, lineHeight: 1.3 }}>
          Votre conseiller
        </Typography>
      </Box>
    </Box>
  );
}
