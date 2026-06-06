import { Inter, Geist_Mono } from "next/font/google";

/**
 * App fonts (doc 10 §3). Inter for UI/text, Geist Mono for data/numbers.
 * Loaded via next/font (self-hosted, zero CLS, preload). Exposed as CSS
 * variables so the MUI theme and globals can reference them.
 */
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const fontVariables = `${inter.variable} ${geistMono.variable}`;
