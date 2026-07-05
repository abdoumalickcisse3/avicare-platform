"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import { AppShell } from "@/components/layout/AppShell";
import { hasAccessToken } from "@/lib/auth";

const noopSubscribe = () => () => {};

/**
 * Client-side auth guard. Tokens live in localStorage (V1). `useSyncExternalStore`
 * drives the render (server snapshot = false → spinner, then the client snapshot
 * flips it once localStorage is read). The redirect effect re-reads the token LIVE
 * rather than the render snapshot, so a page refresh never bounces an authenticated
 * user to /login during hydration (the server snapshot is false at that instant).
 * The proper edge guard arrives with httpOnly-cookie refresh.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const authorized = useSyncExternalStore(
    noopSubscribe,
    () => hasAccessToken(),
    () => false,
  );

  useEffect(() => {
    // Live read on the client (localStorage is available here), not the possibly
    // stale hydration snapshot — otherwise a refresh redirects a logged-in user.
    if (!hasAccessToken()) router.replace("/login");
  }, [router]);

  if (!authorized) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <AppShell>{children}</AppShell>;
}
