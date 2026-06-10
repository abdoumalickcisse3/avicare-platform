"use client";

import { Box, Card, Typography } from "@mui/material";
import type { LucideIcon } from "lucide-react";
import { colors } from "@/theme/tokens";

/**
 * "Coming soon" tab placeholder, mirroring the broiler HealthTab pattern for
 * visual consistency. Used for the Pondeuses and Sanitaire tabs (Phase C).
 */
export function LayerPlaceholderTab({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Card
      sx={{
        py: 6,
        px: 3,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: colors.accent[50],
          color: colors.accent[500],
        }}
      >
        <Icon size={28} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
        {description}
      </Typography>
    </Card>
  );
}
