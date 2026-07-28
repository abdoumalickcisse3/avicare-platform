"use client";

import type { ReactNode } from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { LucideIcon } from "lucide-react";
import { colors } from "@/theme/tokens";
import { formatCurrency, formatNumber } from "@/lib/format";

export interface StatCardProps {
  label: string;
  value: number;
  kind: "currency" | "count";
  icon: LucideIcon;
  /** Icon tint — must come from `@/theme/tokens` (no hardcoded hex in callers). */
  tint: string;
  /** Optional real series (period values) — drives the trend badge, first → last. */
  series?: number[];
  /** Alert tile: renders in warning colour with an "à régler" badge when value > 0. */
  alert?: boolean;
}

/**
 * Compact KPI stat card (Avicare Design System / Stitch): a small tinted icon
 * disc, a contextual badge, a prominent value and a label — kept dense so a
 * row of four reads at a glance without dominating the page.
 *
 * The badge is honest: derived from the real `series` (period trend, first vs
 * last), shown only when the data supports a comparison. Alert tiles show an
 * attention badge instead.
 */
export function StatCard({ label, value, kind, icon: Icon, tint, series, alert }: StatCardProps) {
  const isAlert = alert === true && value > 0;
  const discTint = isAlert ? colors.warning.main : tint;

  let trend: { pct: number; up: boolean } | null = null;
  if (!isAlert && Array.isArray(series) && series.length >= 2) {
    const first = series.find((v) => v > 0);
    const last = series[series.length - 1];
    if (first != null && first > 0 && Number.isFinite(last)) {
      const pct = ((last - first) / first) * 100;
      if (Math.abs(pct) >= 1) trend = { pct: Math.round(Math.abs(pct)), up: pct >= 0 };
    }
  }

  const formatted = kind === "currency" ? formatCurrency(value) : formatNumber(value);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: 1.75, "&:last-child": { pb: 1.75 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box
            aria-hidden
            sx={{
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(discTint, 0.12),
              color: discTint,
            }}
          >
            <Icon size={17} strokeWidth={2.2} />
          </Box>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", fontWeight: 600, display: "block", lineHeight: 1.3 }}
              noWrap
            >
              {label}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "baseline" }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: "1.35rem",
                  lineHeight: 1.15,
                  color: isAlert ? colors.warning.dark : "text.primary",
                  fontVariantNumeric: "tabular-nums",
                }}
                noWrap
              >
                {formatted}
              </Typography>
              {isAlert ? (
                <Badge tone={colors.warning}>à régler</Badge>
              ) : trend ? (
                <Badge tone={trend.up ? colors.success : colors.error}>
                  {trend.up ? "▲" : "▼"} {trend.pct}%
                </Badge>
              ) : null}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Small pill badge — tone is a token colour object ({ light, dark }). */
function Badge({ tone, children }: { tone: { light: string; dark: string }; children: ReactNode }) {
  return (
    <Box sx={{ px: 0.75, py: 0.1, borderRadius: 999, bgcolor: tone.light, display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
      <Typography sx={{ color: tone.dark, fontWeight: 700, fontSize: "0.65rem", lineHeight: 1.5 }}>{children}</Typography>
    </Box>
  );
}
