"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import { partnerTokenStorage } from "@/lib/partnerStorage";
import { colors } from "@/theme/tokens";

const noopSubscribe = () => () => {};

/**
 * Partner-portal shell + client route guard. The partner token lives in localStorage (like the
 * farmer app), so the guard runs client-side via {@link useSyncExternalStore} (server snapshot =
 * false → spinner, client snapshot flips once localStorage is read). The redirect effect re-reads
 * the token LIVE. The {@code /portal/login} route is exempt (rendered by this same layout).
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

  return <Box sx={{ minHeight: "100dvh", bgcolor: colors.neutral[50] }}>{children}</Box>;
}
