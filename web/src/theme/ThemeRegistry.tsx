"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { avicareTheme } from "./index";
import { ToastProvider } from "@/components/feedback/ToastProvider";

/**
 * Wraps the app with the MUI theme and the App-Router-aware Emotion cache
 * (SSR-safe style injection via useServerInsertedHTML under the hood), avoiding
 * the FOUC / hydration mismatch that a naive ThemeProvider would cause.
 */
export function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ThemeProvider theme={avicareTheme}>
        <CssBaseline />
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
