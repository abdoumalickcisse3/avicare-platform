import { Box } from "@mui/material";
import { BrandPanel } from "@/components/auth/BrandPanel";

/**
 * Split-screen shell for the auth pages: the branded green panel on the left
 * (hidden below md, mobile-first) and the form column on the right. 50/50 on
 * desktop, full-width form on mobile.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <BrandPanel />

      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 3, sm: 6 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 400 }}>{children}</Box>
      </Box>
    </Box>
  );
}
