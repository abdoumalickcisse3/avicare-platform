"use client";

import { Box, Stack, Typography } from "@mui/material";

/** A section label with a colored bar — shared across the health dialogs. */
export function SectionLabel({
  color,
  children,
}: {
  color: string;
  children: string;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Box sx={{ width: 4, height: 16, borderRadius: 1, bgcolor: color }} />
      <Typography sx={{ fontWeight: 600 }}>{children}</Typography>
    </Stack>
  );
}

/** ISO yyyy-mm-dd today helper for date input defaults. */
export const today = () => new Date().toISOString().slice(0, 10);
