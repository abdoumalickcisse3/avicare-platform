"use client";

import { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Activity, ShieldCheck, Syringe } from "lucide-react";
import {
  useGetObservationsQuery,
  useGetProgramAssignmentQuery,
  useGetScheduleQuery,
} from "@/store/api/healthApi";
import { isoToday, daysBetween } from "@/lib/health";
import { colors } from "@/theme/tokens";

const monoSx = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
} as const;

/**
 * Three lot-level health KPIs derived from the health module's own data
 * (vaccination schedule + observations). Mortality lives in the production
 * tabs, so it is intentionally not duplicated here.
 */
export function HealthLotKpis({ farmId, unitId }: { farmId: number; unitId: number }) {
  const { data: assignment } = useGetProgramAssignmentQuery({ farmId, unitId });
  const { data: schedule = [], isLoading: scheduleLoading } = useGetScheduleQuery(
    { farmId, unitId },
    { skip: !assignment },
  );
  const { data: observations = [] } = useGetObservationsQuery({ farmId, unitId });

  const { done, total, late } = useMemo(() => {
    const total = schedule.length;
    const done = schedule.filter((s) => s.status === "DONE").length;
    const late = schedule.filter((s) => s.status === "LATE").length;
    return { done, total, late };
  }, [schedule]);

  const recentCritical = useMemo(() => {
    const today = isoToday();
    return observations.filter(
      (o) =>
        (o.severity === "CRITICAL" || o.severity === "WARNING") &&
        daysBetween(o.observationDate, today) <= 7,
    ).length;
  }, [observations]);

  const status =
    late > 0 || recentCritical > 0
      ? { label: "VIGILANCE", bg: colors.warning.light, fg: colors.warning.dark }
      : { label: "SAIN", bg: colors.success.light, fg: colors.success.dark };

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
      }}
    >
      <Card>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Vaccins effectués
              </Typography>
              {scheduleLoading ? (
                <Skeleton width={60} height={32} />
              ) : (
                <Typography sx={{ ...monoSx, fontSize: "1.5rem" }}>
                  {done}/{total}
                </Typography>
              )}
            </Box>
            <KpiIcon icon={<Syringe size={18} />} tint={colors.primary[600]} />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: colors.neutral[100],
              "& .MuiLinearProgress-bar": { bgcolor: colors.primary[500] },
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Vaccins en retard
              </Typography>
              <Typography
                sx={{ ...monoSx, fontSize: "1.5rem", color: late > 0 ? colors.error.main : colors.neutral[800] }}
              >
                {late}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {late > 0 ? "À régulariser" : "À jour"}
              </Typography>
            </Box>
            <KpiIcon icon={<Activity size={18} />} tint={late > 0 ? colors.error.main : colors.success.main} />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Statut sanitaire
              </Typography>
              <Box sx={{ mt: 0.75 }}>
                <Chip
                  label={status.label}
                  sx={{ bgcolor: status.bg, color: status.fg, fontWeight: 700 }}
                />
              </Box>
              {recentCritical > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  {recentCritical} observation(s) à surveiller (7 j)
                </Typography>
              )}
            </Box>
            <KpiIcon icon={<ShieldCheck size={18} />} tint={status.fg} />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function KpiIcon({ icon, tint }: { icon: React.ReactNode; tint: string }) {
  return (
    <Box
      sx={{
        width: 40,
        height: 40,
        borderRadius: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: `${tint}1A`,
        color: tint,
      }}
    >
      {icon}
    </Box>
  );
}
