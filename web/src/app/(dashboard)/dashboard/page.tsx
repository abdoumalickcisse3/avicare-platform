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
import { useGetProfileQuery } from "@/store/api/authApi";
import { useGetDashboardQuery } from "@/store/api/dashboardApi";
import { useAppDispatch } from "@/store/hooks";
import { setCurrentUser } from "@/store/slices/authSlice";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { TrialBanner } from "@/components/dashboard/TrialBanner";
import { HeroKpiRow } from "@/components/dashboard/HeroKpiRow";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { CommercialSection } from "@/components/dashboard/CommercialSection";
import { LivestockSection } from "@/components/dashboard/LivestockSection";
import { BentoGrid, BentoItem } from "@/components/dashboard/widgets";
import { periodToQuery } from "@/lib/dashboard";
import type { DashboardPeriodState } from "@/types/dashboard";

// ── Inventory placeholder (Phase 3) ─────────────────────────────────────────

function InventoryPlaceholder() {
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
      {farmId && <PeriodSelector value={period} onChange={setPeriod} />}

      {/* ── Loading skeletons ── */}
      {farmId && isPageLoading && (
        <>
          {/* Hero row skeleton */}
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
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                height={100}
                sx={{ borderRadius: 2 }}
              />
            ))}
          </Box>

          {/* Bento skeleton — 3 representative cells */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                lg: "repeat(3, 1fr)",
              },
            }}
          >
            {[0, 1, 2].map((i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                height={200}
                sx={{ borderRadius: 2 }}
              />
            ))}
          </Box>
        </>
      )}

      {/* ── Hero KPI row + bento grid — rendered once data is ready ── */}
      {farmId && !isPageLoading && (
        <>
          {/* 4-tile hero row (adaptive, sourced from active modules) */}
          {dashboardData && <HeroKpiRow data={dashboardData} />}

          {/* Module widgets interleaved in a single bento grid */}
          {dashboardData && hasAnySection ? (
            <BentoGrid>
              {dashboardData.commercial && (
                <CommercialSection data={dashboardData.commercial} />
              )}
              {dashboardData.livestock && (
                <LivestockSection data={dashboardData.livestock} />
              )}
              {/* Inventory placeholder — Phase 3 (replace with real bento items) */}
              {dashboardData.inventory && (
                <BentoItem colSpan={12}>
                  <InventoryPlaceholder />
                </BentoItem>
              )}
            </BentoGrid>
          ) : (
            dashboardData && (
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
            )
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
