"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bird,
  FileText,
  HeartPulse,
  type LucideIcon,
  Pill,
  Syringe,
  Truck,
  Wallet,
} from "lucide-react";
import { Box, Card, CardContent, Divider, Skeleton, Stack, Typography } from "@mui/material";
import { useGetProfileQuery } from "@/store/api/authApi";
import { useGetDashboardQuery } from "@/store/api/dashboardApi";
import { useGetMyFarmsQuery } from "@/store/api/farmsApi";
import { useAppDispatch } from "@/store/hooks";
import { setCurrentUser } from "@/store/slices/authSlice";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { FarmsTable } from "@/components/dashboard/FarmsTable";
import { CommercialPanel } from "@/components/dashboard/CommercialPanel";
import { LivestockPanel } from "@/components/dashboard/LivestockPanel";
import { MiniStat } from "@/components/dashboard/MiniStat";
import { AreaTrend, type Point } from "@/components/dashboard/charts/RechartsWidgets";
import { pickHeroTiles } from "@/lib/dashboardHero";
import { periodToQuery } from "@/lib/dashboard";
import { formatCurrency, formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { DashboardPeriodState, DashboardResponse } from "@/types/dashboard";

const KPI_ICON: Record<string, { icon: LucideIcon; tint: string }> = {
  ca: { icon: Wallet, tint: colors.primary[500] },
  impayes: { icon: AlertTriangle, tint: colors.warning.main },
  effectif: { icon: Bird, tint: colors.primary[500] },
  morts: { icon: HeartPulse, tint: colors.error.main },
  "cmd-livrer": { icon: Truck, tint: colors.info.main },
  vaccins: { icon: Syringe, tint: colors.success.main },
  traitements: { icon: Pill, tint: colors.vet.main },
  "fact-encaisser": { icon: FileText, tint: colors.info.main },
};

interface MainChart {
  label: string;
  series: Point[];
  color: string;
  format: (v: number) => string;
  unit?: string;
}

/** All available "performance" series, in priority order: laying → mortality → revenue. */
function pickCharts(data: DashboardResponse): MainChart[] {
  const l = data.livestock;
  const c = data.commercial;
  const out: MainChart[] = [];
  if (l?.layingSeries?.length) out.push({ label: "Production d'œufs", series: l.layingSeries, color: colors.primary[500], format: formatNumber, unit: "œufs" });
  if (l?.mortalitySeries?.length) out.push({ label: "Mortalité journalière", series: l.mortalitySeries, color: colors.error.main, format: formatNumber, unit: "têtes" });
  if (c?.revenueSeries?.length) out.push({ label: "Chiffre d'affaires", series: c.revenueSeries, color: colors.accent[400], format: formatCurrency });
  return out;
}

/** Period summary derived from a series — total, daily average, peak. */
function summarize(chart: MainChart): { total: string; avg: string; peak: string } {
  const vals = chart.series.map((p) => p.valueXof);
  const total = vals.reduce((a, b) => a + b, 0);
  const avg = vals.length ? total / vals.length : 0;
  const peak = vals.length ? Math.max(...vals) : 0;
  return { total: chart.format(total), avg: chart.format(Math.round(avg)), peak: chart.format(peak) };
}

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const { data: profile, isLoading: profileLoading } = useGetProfileQuery();
  const { farmId } = useSelectedFarm();
  const { data: farms } = useGetMyFarmsQuery();

  const [period, setPeriod] = useState<DashboardPeriodState>({ kind: "preset", preset: "30d" });

  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    isFetching,
  } = useGetDashboardQuery(
    { farmId: farmId as number, query: periodToQuery(period) },
    { skip: !farmId },
  );

  useEffect(() => {
    if (profile) dispatch(setCurrentUser(profile));
  }, [profile, dispatch]);

  const firstName = profile?.fullName?.trim().split(/\s+/)[0];
  const farmName = farms?.find((f) => f.id === farmId)?.name;
  const isPageLoading = dashboardLoading || isFetching;

  const tiles = dashboardData ? pickHeroTiles(dashboardData) : [];
  const charts = dashboardData ? pickCharts(dashboardData) : [];
  const mainChart = charts[0] ?? null;
  const secondChart = charts[1] ?? null;
  const commercial = dashboardData?.commercial;
  const livestock = dashboardData?.livestock;
  const bothPanels = !!commercial && !!livestock;

  return (
    <Stack spacing={2.5}>
      {/* Greeting + period control */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", md: "flex-end" } }}
      >
        <Box>
          {profileLoading ? (
            <Skeleton variant="text" width={240} height={34} />
          ) : (
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
              Bonjour{firstName ? `, ${firstName}` : ""} 👋
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {farmName ? `Voici ce qui se passe sur ${farmName} aujourd'hui.` : "Voici un aperçu de votre activité."}
          </Typography>
        </Box>
        {farmId && <PeriodSelector value={period} onChange={setPeriod} />}
      </Stack>

      {/* Loading skeletons */}
      {farmId && isPageLoading && (
        <>
          <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={72} sx={{ borderRadius: 2 }} />
            ))}
          </Box>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" } }}>
            <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2 }} />
          </Box>
        </>
      )}

      {/* Content */}
      {farmId && !isPageLoading && dashboardData && (
        <>
          {/* Compact KPI strip */}
          {tiles.length > 0 && (
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}>
              {tiles.map((t) => {
                const style = KPI_ICON[t.key] ?? { icon: Bird, tint: colors.primary[500] };
                return (
                  <StatCard key={t.key} label={t.label} value={t.value} kind={t.kind} icon={style.icon} tint={style.tint} series={t.series} alert={t.alert} />
                );
              })}
            </Box>
          )}

          {/* Main trend (Recharts area) + recent activity */}
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, alignItems: "stretch" }}>
            <Card sx={{ height: "100%" }}>
              <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <Typography sx={{ fontWeight: 700, fontSize: "1rem", mb: 0.5 }}>
                  {mainChart?.label ?? "Performance"}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                  Évolution sur la période
                </Typography>
                {mainChart ? (
                  <>
                    <AreaTrend data={mainChart.series} color={mainChart.color} format={mainChart.format} unit={mainChart.unit} height={220} />

                    {/* Period summary — fills the space below the curve with real figures */}
                    {(() => {
                      const s = summarize(mainChart);
                      const cells = [
                        { l: "Total période", v: s.total },
                        { l: "Moyenne / jour", v: s.avg },
                        { l: "Meilleur jour", v: s.peak },
                      ];
                      return (
                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.25, mt: 1.5 }}>
                          {cells.map((c) => (
                            <MiniStat key={c.l} label={c.l} value={c.v} tint={mainChart.color} />
                          ))}
                        </Box>
                      );
                    })()}

                    {/* Secondary series — the next available metric, filling the remaining height */}
                    {secondChart && (
                      <Box sx={{ mt: "auto", pt: 2 }}>
                        <Divider sx={{ mb: 1.5 }} />
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.5 }}>
                          {secondChart.label}
                        </Typography>
                        <AreaTrend data={secondChart.series} color={secondChart.color} format={secondChart.format} unit={secondChart.unit} height={130} />
                      </Box>
                    )}
                  </>
                ) : (
                  <Box sx={{ flex: 1, minHeight: 260, display: "grid", placeItems: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      Pas encore de données de production sur la période.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
            <ActivityFeed farmId={farmId} />
          </Box>

          {/* Detail panels — all the other statistics */}
          {(commercial || livestock) && (
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: bothPanels ? "1fr 1fr" : "1fr" } }}>
              {commercial && <CommercialPanel data={commercial} />}
              {livestock && <LivestockPanel data={livestock} />}
            </Box>
          )}

          {/* Farms status table */}
          <FarmsTable selectedFarmId={farmId} />
        </>
      )}

      {/* No farm selected */}
      {!farmId && !dashboardLoading && (
        <Card>
          <CardContent>
            <Stack spacing={1.5} sx={{ py: 6, textAlign: "center", alignItems: "center" }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Bienvenue sur Jawdi
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                Créez votre première ferme pour voir vos indicateurs, votre activité et vos bandes ici.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
