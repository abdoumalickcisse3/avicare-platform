import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "@/theme/fonts";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import { StoreProvider } from "@/store/StoreProvider";

export const metadata: Metadata = {
  title: "AviCare Platform",
  description: "Plateforme de gestion d'élevage pour l'Afrique de l'Ouest.",
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
      </body>
    </html>
  );
}
