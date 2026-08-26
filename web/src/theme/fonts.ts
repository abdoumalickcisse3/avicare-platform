import localFont from "next/font/local";

/**
 * App fonts (doc 10 §3). Outfit for UI/text, JetBrains Mono for data/numbers.
 *
 * Self-hosted rather than fetched through `next/font/google`: that variant downloads the woff2
 * from fonts.gstatic.com **at build time**, so every production build depended on a live request
 * to Google. One failed request took a whole deploy down with
 * "Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'".
 *
 * The files are the exact `latin` subsets Google was serving (Outfit v15, JetBrains Mono v24) —
 * the same bytes as before, now committed. Latin covers U+0000–00FF, so every French accent and
 * the punctuation the UI uses (« », —, €) is included.
 *
 * Both are variable fonts, hence the weight ranges. Exposed as CSS variables so the MUI theme and
 * globals keep referencing them unchanged.
 *
 * To refresh a font, re-download its `latin` woff2 from the Google Fonts CSS API and replace the
 * file; nothing else here changes.
 */
export const outfit = localFont({
  src: "./fonts/Outfit-Variable-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-sans",
  display: "swap",
});

export const jetBrainsMono = localFont({
  src: "./fonts/JetBrainsMono-Variable-latin.woff2",
  weight: "100 800",
  style: "normal",
  variable: "--font-mono",
  display: "swap",
});

export const fontVariables = `${outfit.variable} ${jetBrainsMono.variable}`;
