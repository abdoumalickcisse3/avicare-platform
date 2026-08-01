import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "@/theme/fonts";
import { colors } from "@/theme/tokens";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import { StoreProvider } from "@/store/StoreProvider";
import { RegisterSW } from "@/components/pwa/RegisterSW";

export const metadata: Metadata = {
  applicationName: "Jawdi",
  title: "Jawdi Platform",
  description: "Plateforme de gestion d'élevage pour l'Afrique de l'Ouest.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Jawdi",
  },
};

export const viewport: Viewport = {
  themeColor: colors.primary[700],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={fontVariables}>
      <body>
        <StoreProvider>
          <ThemeRegistry>{children}</ThemeRegistry>
        </StoreProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
