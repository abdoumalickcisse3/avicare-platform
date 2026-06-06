import { Box, Stack, Typography } from "@mui/material";
import { colors } from "@/theme/tokens";

/**
 * Split-screen shell for the auth pages: a branded green panel on the left
 * (hidden below md, mobile-first) and the form column on the right.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          width: "45%",
          p: 6,
          color: colors.neutral[0],
          background: `linear-gradient(160deg, ${colors.primary[600]} 0%, ${colors.primary[800]} 100%)`,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          AviCare
        </Typography>
        <Stack spacing={2}>
          <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
            La gestion d&apos;élevage,
            <br />
            simplifiée.
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.85 }}>
            Pilotez vos bandes, vos coûts et vos performances depuis une seule
            plateforme pensée pour l&apos;Afrique de l&apos;Ouest.
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          © {new Date().getFullYear()} AviCare Platform
        </Typography>
      </Box>

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
