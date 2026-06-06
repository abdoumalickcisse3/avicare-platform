"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import { hasAccessToken } from "@/lib/auth";

/** Entry point: client-side redirect to /dashboard or /login (tokens live in localStorage). */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(hasAccessToken() ? "/dashboard" : "/login");
  }, [router]);

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
