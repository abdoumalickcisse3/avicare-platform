import type { MetadataRoute } from "next";
import { colors } from "@/theme/tokens";

/**
 * PWA web manifest — makes the dashboard installable (Add to Home Screen /
 * desktop install). Icons are the real logo, rasterised from the brand kit by
 * scripts/build-brand-assets.py. Colors come from the design system.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jawdi Platform",
    short_name: "Jawdi",
    description:
      "Gérez votre élevage avicole — cheptel, stock, ventes et finances, sur le terrain.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: colors.neutral[50],
    theme_color: colors.primary[700],
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
