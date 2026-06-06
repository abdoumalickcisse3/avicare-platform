import { Outfit, JetBrains_Mono } from "next/font/google";

/**
 * App fonts (doc 10 §3). Outfit for UI/text, JetBrains Mono for data/numbers.
 * Loaded via next/font (self-hosted, zero CLS, preload). Exposed as CSS
 * variables so the MUI theme and globals can reference them.
 */
export const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const fontVariables = `${outfit.variable} ${jetBrainsMono.variable}`;
