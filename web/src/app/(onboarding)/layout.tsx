"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import { hasAccessToken } from "@/lib/auth";
import { colors } from "@/theme/tokens";

const noopSubscribe = () => () => {};

/**
 * Fullscreen shell for the post-signup onboarding wizard — no AppShell, just a
 * neutral backdrop. Reuses the client-side auth guard (tokens in localStorage,
 * V1) so an unauthenticated user is sent to /login.
 */
export default function OnboardingLayout({
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

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: colors.neutral[50] }}>
      {children}
    </Box>
  );
}
