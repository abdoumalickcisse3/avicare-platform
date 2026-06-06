"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import { AppShell } from "@/components/layout/AppShell";
import { hasAccessToken } from "@/lib/auth";

const noopSubscribe = () => () => {};

/**
 * Client-side auth guard. Tokens live in localStorage (V1), so the gate runs in
 * the browser: unauthenticated users are bounced to /login before any dashboard
 * content renders. `useSyncExternalStore` reads the token client-only (server
 * snapshot = false) to avoid a hydration mismatch. The proper edge guard
 * arrives with httpOnly-cookie refresh.
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
    if (!authorized) router.replace("/login");
  }, [authorized, router]);

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
