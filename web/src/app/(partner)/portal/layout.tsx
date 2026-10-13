"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Box, CircularProgress, Typography } from "@mui/material";
import { partnerTokenStorage } from "@/lib/partnerStorage";
import { colors } from "@/theme/tokens";

const noopSubscribe = () => () => {};

/**
 * Partner-portal shell + client route guard. The partner token lives in localStorage (like the
 * farmer app), so the guard runs client-side via {@link useSyncExternalStore} (server snapshot =
 * false → spinner, client snapshot flips once localStorage is read). The redirect effect re-reads
 * the token LIVE. The {@code /portal/login} route is exempt (rendered by this same layout).
 *
 * Co-branding : Jawdi tient la barre du haut, le partenaire tient le contenu.
 * Le provendier voit d'abord son propre réseau ; l'outil qui le lui montre se
 * nomme une fois, discrètement, et ne se répète pas. La page de connexion s'en
 * passe : elle porte déjà le logo en grand.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/portal/login";

  const hasToken = useSyncExternalStore(
    noopSubscribe,
    () => partnerTokenStorage.getAccess() !== null,
    () => false,
  );

  useEffect(() => {
    if (!isLogin && partnerTokenStorage.getAccess() === null) {
      router.replace("/portal/login");
    }
  }, [isLogin, router]);

  if (!isLogin && !hasToken) {
    return (
      <Box
        sx={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: colors.neutral[50],
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: colors.neutral[50] }}>
      {!isLogin && (
        <Box
          component="header"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            px: { xs: 2, md: 3 },
            py: 1.25,
            bgcolor: colors.neutral[0],
            borderBottom: `1px solid ${colors.neutral[200]}`,
          }}
        >
          <Box
            component="img"
            src="/logo/logo-compact.svg"
            alt="Jawdi"
            sx={{ height: 28, width: "auto", display: "block" }}
          />
          <Typography variant="caption" sx={{ color: colors.neutral[500], letterSpacing: 0.6 }}>
            PORTAIL PARTENAIRE
          </Typography>
        </Box>
      )}
      {children}
    </Box>
  );
}
