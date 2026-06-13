"use client";

import { useMemo } from "react";
import NextLink from "next/link";
import {
  Alert,
  Box,
  Button,
  Card,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowRight, BookOpen, CalendarRange, HeartPulse } from "lucide-react";
import { useHealthGating } from "@/hooks/useHealthGating";
import {
  useGetHealthAlertsQuery,
  useGetProgramsQuery,
  useGetTreatmentCatalogQuery,
  useGetVaccinesQuery,
} from "@/store/api/healthApi";
import { useGetProductionUnitsQuery } from "@/store/api/productionUnitsApi";
import { apiErrorMessage } from "@/lib/apiError";
import { isFeatureForbidden } from "@/lib/poultry";
import { colors } from "@/theme/tokens";
import { AdvancedLockCard } from "./AdvancedLockCard";
import { HealthOverviewKpis } from "./HealthOverviewKpis";
import { HealthTimeline } from "./HealthTimeline";
import { NewHealthEventMenu } from "./NewHealthEventMenu";

const monoSx = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
} as const;

export function HealthOverviewView() {
  const { farmId, hasFarm, hasHealth, hasAdvanced, isLoading: gatingLoading } =
    useHealthGating();

  const skip = !hasFarm || !farmId;
  const { data: alerts, isLoading: alertsLoading, error } = useGetHealthAlertsQuery(
    { farmId: farmId as number },
    { skip },
  );
  const { data: units = [] } = useGetProductionUnitsQuery(
    { farmId: farmId as number },
    { skip },
  );
  const { data: vaccines = [] } = useGetVaccinesQuery({ farmId: farmId as number }, { skip });
  const { data: programs = [] } = useGetProgramsQuery({ farmId: farmId as number }, { skip });
  const { data: treatments = [] } = useGetTreatmentCatalogQuery(
    { farmId: farmId as number },
    { skip: skip || !hasAdvanced },
  );

  const unitName = useMemo(() => {
    const map = new Map(units.map((u) => [u.id, u.name || `Lot #${u.id}`]));
    return (id: number) => map.get(id) ?? `Lot #${id}`;
  }, [units]);

  if (!gatingLoading && hasFarm && !hasHealth) {
    return (
      <Box>
        <PageHeader />
        <AdvancedLockCard
          farmId={farmId}
          title="Module sanitaire inactif"
          description="Activez health.basic pour suivre les vaccinations et observations, ou health.advanced pour les traitements et vétérinaires."
        />
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" }, mb: 3 }}
      >
        <PageHeader />
        {hasFarm && farmId && <NewHealthEventMenu farmId={farmId} hasAdvanced={hasAdvanced} />}
      </Stack>

      {error && !isFeatureForbidden(error) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {apiErrorMessage(error)}
        </Alert>
      )}

      <Stack spacing={3}>
        <HealthOverviewKpis alerts={alerts} isLoading={alertsLoading} />

        <HealthTimeline alerts={alerts} isLoading={alertsLoading} unitName={unitName} />

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          {/* Vaccination programs */}
          <Card sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
              <CalendarRange size={18} color={colors.primary[600]} />
              <Typography sx={{ fontWeight: 700 }}>Programmes vaccinaux</Typography>
            </Stack>
            {alertsLoading ? (
              <Skeleton variant="rounded" height={72} />
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {programs.length} programme(s) plateforme disponible(s) ·{" "}
                  {units.length} lot(s) suivi(s).
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Assignez un programme depuis l&apos;onglet Sanitaire de chaque lot pour suivre
                  le calendrier vaccinal.
                </Typography>
              </>
            )}
          </Card>

          {/* Library shortcut */}
          <Card sx={{ p: 2.5, display: "flex", flexDirection: "column" }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
              <BookOpen size={18} color={colors.primary[600]} />
              <Typography sx={{ fontWeight: 700 }}>Bibliothèque médicale</Typography>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 1.5,
                mb: 2,
              }}
            >
              <LibStat label="Vaccins" value={vaccines.length} />
              <LibStat label="Traitements" value={hasAdvanced ? treatments.length : "—"} />
            </Box>
            <Button
              component={NextLink}
              href="/reglages/sanitaire"
              variant="outlined"
              color="primary"
              endIcon={<ArrowRight size={16} />}
              sx={{ mt: "auto", alignSelf: "flex-start" }}
            >
              Gérer la bibliothèque
            </Button>
          </Card>
        </Box>
      </Stack>
    </Box>
  );
}

function PageHeader() {
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <HeartPulse size={22} color={colors.primary[600]} />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Suivi sanitaire
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Vaccinations, traitements, observations et visites vétérinaires.
      </Typography>
    </Box>
  );
}

function LibStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: colors.neutral[50] }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ ...monoSx, fontSize: "1.25rem" }}>{value}</Typography>
    </Box>
  );
}
