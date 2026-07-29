"use client";

import { Box, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { Info } from "lucide-react";
import { colors, radii } from "@/theme/tokens";
import { useGetCatalogQuery } from "@/store/api/catalogApi";
import { useWizard } from "../wizardContext";
import { StepHeader } from "./StepHeader";

/**
 * A review panel for a seeded catalog category (stock articles, sales channels,
 * expense categories). The platform pre-fills sensible defaults, so the owner
 * confirms them here and refines later in the relevant module. Read-only in the
 * wizard — no persistence, just orientation.
 */
export function CatalogReviewStep({
  category,
  title,
  subtitle,
  accent,
  emptyHint,
}: {
  category: string;
  title: string;
  subtitle: string;
  accent: string;
  emptyHint: string;
}) {
  const { farmId } = useWizard();
  const { data, isLoading } = useGetCatalogQuery(
    farmId ? { farmId, category } : ({} as never),
    { skip: !farmId },
  );

  const entries = data ?? [];

  return (
    <Box>
      <StepHeader eyebrow={accent} title={title} subtitle={subtitle} />

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: colors.primary[500] }} />
        </Box>
      ) : entries.length === 0 ? (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "flex-start", p: 2, bgcolor: colors.info.light, borderRadius: radii.lg }}
        >
          <Box sx={{ color: colors.info.main, mt: "2px" }}>
            <Info size={18} />
          </Box>
          <Typography sx={{ fontSize: 14, color: colors.neutral[700] }}>{emptyHint}</Typography>
        </Stack>
      ) : (
        <Box
          sx={{
            p: 2.5,
            bgcolor: colors.neutral[0],
            border: `1px solid ${colors.neutral[200]}`,
            borderRadius: radii.lg,
          }}
        >
          <Typography sx={{ fontSize: 13, color: colors.neutral[500], mb: 1.5 }}>
            {entries.length} élément{entries.length > 1 ? "s" : ""} pré-rempli
            {entries.length > 1 ? "s" : ""} — modifiables plus tard.
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {entries.map((e) => (
              <Chip
                key={e.key}
                label={String(e.value?.label ?? e.key)}
                sx={{
                  bgcolor: colors.primary[50],
                  color: colors.primary[700],
                  fontWeight: 600,
                  borderRadius: radii.md,
                }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
