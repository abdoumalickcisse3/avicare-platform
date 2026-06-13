"use client";

import { Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { CalendarClock, Pill, Stethoscope, Syringe } from "lucide-react";
import { colors } from "@/theme/tokens";
import type { HealthAlerts } from "@/types";

const monoSx = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  fontSize: "1.75rem",
} as const;

/**
 * Four alert KPI tiles for the farm health overview, colored on the left edge.
 * Advanced tiles (treatments, withdrawal, vet visit) read empty when
 * health.advanced is inactive because the backend omits those alert sections.
 */
export function HealthOverviewKpis({
  alerts,
  isLoading,
}: {
  alerts?: HealthAlerts;
  isLoading: boolean;
}) {
  const lateCount = alerts?.vaccinationsLate.length ?? 0;
  const withdrawalCount = alerts?.activeWithdrawals.length ?? 0;
  const nextFollowUp = alerts?.upcomingFollowUps[0];

  const minWithdrawalDays = (() => {
    const days = (alerts?.activeWithdrawals ?? [])
      .flatMap((w) => [w.daysRemainingMeat, w.daysRemainingEggs])
      .filter((d): d is number => d != null && d >= 0);
    return days.length ? Math.min(...days) : null;
  })();

  const tiles = [
    {
      label: "Vaccins en attente",
      value: lateCount,
      hint: lateCount > 0 ? "Doses en retard" : "À jour",
      icon: <Syringe size={18} />,
      color: lateCount > 0 ? colors.error.main : colors.success.main,
    },
    {
      label: "Traitements actifs",
      value: withdrawalCount,
      hint: withdrawalCount > 0 ? "En cours de délai" : "Aucun",
      icon: <Pill size={18} />,
      color: colors.info.main,
    },
    {
      label: "Délais d'attente",
      value: minWithdrawalDays != null ? `J-${minWithdrawalDays}` : "—",
      hint: minWithdrawalDays != null ? "Avant vente autorisée" : "Aucun délai",
      icon: <CalendarClock size={18} />,
      color: colors.warning.main,
    },
    {
      label: "Prochaine visite véto",
      value: nextFollowUp ? `J-${nextFollowUp.daysUntil}` : "—",
      hint: nextFollowUp ? "Suivi programmé" : "Aucun suivi",
      icon: <Stethoscope size={18} />,
      color: colors.vet.main,
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
      }}
    >
      {tiles.map((t) => (
        <Card key={t.label} sx={{ borderLeft: `4px solid ${t.color}` }}>
          <CardContent>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t.label}
                </Typography>
                {isLoading ? (
                  <Skeleton width={48} height={36} />
                ) : (
                  <Typography sx={{ ...monoSx, color: t.color }}>{t.value}</Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {t.hint}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: `${t.color}1A`,
                  color: t.color,
                }}
              >
                {t.icon}
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
