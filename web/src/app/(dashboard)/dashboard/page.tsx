"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Bird, CreditCard, TrendingUp, Warehouse } from "lucide-react";
import { useGetProfileQuery } from "@/store/api/authApi";
import { useGetDashboardQuery } from "@/store/api/dashboardApi";
import { useAppDispatch } from "@/store/hooks";
import { setCurrentUser } from "@/store/slices/authSlice";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { TrialBanner } from "@/components/dashboard/TrialBanner";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { periodToQuery } from "@/lib/dashboard";
import { colors } from "@/theme/tokens";
import type { DashboardPeriodState } from "@/types/dashboard";

// ── Phase-0 section placeholders ────────────────────────────────────────────
// Phases 1-3 will replace these with real widget trees.

function CommercialSection() {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Commercial
        </Typography>
      </CardContent>
    </Card>
  );
}

function LivestockSection() {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Élevage
        </Typography>
      </CardContent>
    </Card>
  );
}

function InventorySection() {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Stocks
        </Typography>
      </CardContent>
    </Card>
  );
}

// ── Default KPI cards (no farm selected / no module data yet) ───────────────

const DEFAULT_KPIS = [
  { label: "Fermes", value: "—", icon: Warehouse, tint: colors.primary[500] },
  { label: "Bandes actives", value: "—", icon: Bird, tint: colors.accent[400] },
  { label: "Performance", value: "—", icon: TrendingUp, tint: colors.info.main },
  { label: "Abonnement", value: "—", icon: CreditCard, tint: colors.success.main },
];

// ── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // All hooks declared before any early return (React Rules of Hooks).
  const dispatch = useAppDispatch();
  const { data: profile, isLoading: profileLoading } = useGetProfileQuery();
  const { farmId } = useSelectedFarm();

  const [period, setPeriod] = useState<DashboardPeriodState>({
    kind: "preset",
    preset: "30d",
  });

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

  // Determine whether any module section is present in the response.
  const hasAnySection =
    !!dashboardData?.commercial ||
    !!dashboardData?.livestock ||
    !!dashboardData?.inventory;

  const isPageLoading = dashboardLoading || isFetching;

  return (
    <Stack spacing={4}>
      <TrialBanner />

      {/* Welcome heading */}
      <Box>
        {profileLoading ? (
          <Skeleton variant="text" width={280} height={40} />
        ) : (
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Bienvenue{profile?.fullName ? `, ${profile.fullName}` : ""}
          </Typography>
        )}
        <Typography variant="body1" color="text.secondary">
          Voici un aperçu de votre activité.
        </Typography>
      </Box>

      {/* Period selector — only shown when a farm is selected */}
      {farmId && (
        <PeriodSelector value={period} onChange={setPeriod} />
      )}

      {/* KPI row — default placeholder cards (populated by phases 1-3) */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
        }}
      >
        {isPageLoading
          ? DEFAULT_KPIS.map((k) => (
              <Skeleton key={k.label} variant="rectangular" height={96} sx={{ borderRadius: 2 }} />
            ))
          : DEFAULT_KPIS.map((k) => (
              <KpiCard
                key={k.label}
                label={k.label}
                value={k.value}
                icon={k.icon}
                tint={k.tint}
              />
            ))}
      </Box>

      {/* Adaptive section containers — mounted only when the API says the module is active */}
      {farmId && !isPageLoading && (
        <>
          {hasAnySection ? (
            <Stack spacing={3}>
              {dashboardData?.commercial && <CommercialSection />}
              {dashboardData?.livestock && <LivestockSection />}
              {dashboardData?.inventory && <InventorySection />}
            </Stack>
          ) : (
            <Card>
              <CardContent>
                <Stack
                  spacing={1.5}
                  sx={{ py: 6, textAlign: "center", alignItems: "center" }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Aucun module actif
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ maxWidth: 420 }}
                  >
                    Activez un module commercial, élevage ou stock pour voir vos
                    indicateurs ici.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* No farm selected yet */}
      {!farmId && !dashboardLoading && (
        <Card>
          <CardContent>
            <Stack
              spacing={1.5}
              sx={{ py: 6, textAlign: "center", alignItems: "center" }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Bientôt disponible
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ maxWidth: 420 }}
              >
                La gestion des fermes, de l&apos;équipe et de vos bandes arrive
                dans les prochaines mises à jour.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
