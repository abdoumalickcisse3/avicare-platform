"use client";

import NextLink from "next/link";
import { Box, Button, Card, Stack, Typography } from "@mui/material";
import { Lock, Sparkles } from "lucide-react";
import { colors } from "@/theme/tokens";

/**
 * CTA shown in place of advanced-only sections (treatments, vet directory, vet
 * visits) when module.health.advanced is inactive. Frontend hiding only — the
 * backend still answers 403 if called directly.
 */
export function AdvancedLockCard({
  farmId,
  title,
  description,
}: {
  farmId?: number;
  title: string;
  description: string;
}) {
  return (
    <Card
      sx={{
        py: 4,
        px: 3,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.25,
        borderStyle: "dashed",
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: colors.accent[50],
          color: colors.accent[500],
        }}
      >
        <Lock size={22} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
        {description}
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
        <Button
          component={NextLink}
          href={farmId ? `/fermes/${farmId}?tab=subscription` : "/fermes"}
          variant="contained"
          color="secondary"
          startIcon={<Sparkles size={18} />}
        >
          Activer health.advanced
        </Button>
      </Stack>
    </Card>
  );
}
