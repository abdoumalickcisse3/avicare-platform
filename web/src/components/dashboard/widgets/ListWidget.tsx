"use client";

import { Box, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { colors } from "@/theme/tokens";

export interface ListWidgetRow {
  /** Unique key for React reconciliation. */
  key: string | number;
  /** Main label — client name, article name, etc. */
  label: string;
  /** Formatted value string (already passed through formatCurrency / formatNumber). */
  value: string;
  /** Optional navigation target — renders row as an accessible link. */
  href?: string;
}

export interface ListWidgetProps {
  /** Widget title. */
  title: string;
  /** Ordered list of rows (top-N). */
  items: ListWidgetRow[];
  /** Message shown when items is empty. */
  emptyMessage?: string;
}

/**
 * Titled top-N list widget. Rows with an `href` are rendered as accessible
 * next/link elements. Pure presentational — no fetching, token colours only.
 */
export function ListWidget({
  title,
  items,
  emptyMessage = "Aucune donnée.",
}: ListWidgetProps) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
          {title}
        </Typography>

        {items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        ) : (
          <Stack divider={<Divider />} spacing={0}>
            {items.map((row, idx) => {
              const inner = (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 0.875,
                    px: row.href ? 0.5 : 0,
                    gap: 1,
                    ...(row.href
                      ? {
                          borderRadius: 1,
                          "&:hover": { bgcolor: "action.hover" },
                        }
                      : {}),
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        width: 18,
                        flexShrink: 0,
                        textAlign: "right",
                        color: "text.disabled",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {idx + 1}
                    </Typography>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{ color: row.href ? colors.primary[600] : "text.primary" }}
                    >
                      {row.label}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      flexShrink: 0,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {row.value}
                  </Typography>
                </Box>
              );

              return row.href ? (
                <Box
                  key={row.key}
                  component={Link}
                  href={row.href}
                  sx={{ display: "block", textDecoration: "none", color: "inherit" }}
                >
                  {inner}
                </Box>
              ) : (
                <Box key={row.key}>{inner}</Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
