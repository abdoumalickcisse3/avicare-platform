"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import { adminTokenStorage } from "@/lib/adminStorage";
import { colors } from "@/theme/tokens";

const noopSubscribe = () => () => {};

/**
 * Back-office shell + client route guard, same shape as the partner portal: the staff token lives
 * in localStorage, so the guard runs client-side through {@link useSyncExternalStore} (server
 * snapshot = false → spinner, client snapshot flips once localStorage is read).
 *
 * This is convenience, not security. The real hardening is `middleware.ts`, which 404s
 * `/console/**` off the admin subdomain, and every endpoint being gated server-side.
 */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/console/login";

  const hasToken = useSyncExternalStore(
    noopSubscribe,
    () => adminTokenStorage.getAccess() !== null,
    () => false,
  );

  useEffect(() => {
    if (!isLogin && adminTokenStorage.getAccess() === null) {
      router.replace("/console/login");
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
