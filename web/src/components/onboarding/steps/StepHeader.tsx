"use client";

import { Box, Stack, Typography } from "@mui/material";
import { colors } from "@/theme/tokens";

/** Consistent title block atop every wizard panel: eyebrow chip + title + subtitle. */
export function StepHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Stack spacing={1.5} sx={{ mb: 4 }}>
      {eyebrow && (
        <Box
          sx={{
            alignSelf: "flex-start",
            px: 1.5,
            py: 0.5,
            borderRadius: 999,
            bgcolor: colors.primary[50],
            color: colors.primary[600],
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          {eyebrow}
        </Box>
      )}
      <Typography
        sx={{
          fontWeight: 800,
          fontSize: { xs: 26, md: 32 },
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: colors.neutral[800],
        }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontSize: 16, color: colors.neutral[500], maxWidth: 520 }}>
          {subtitle}
        </Typography>
      )}
    </Stack>
  );
}
