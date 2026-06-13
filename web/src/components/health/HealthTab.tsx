"use client";

import { Box, Stack } from "@mui/material";
import { useAppSelector } from "@/store/hooks";
import { useHealthGating } from "@/hooks/useHealthGating";
import { ageInDays } from "@/lib/poultry";
import { AdvancedLockCard } from "./AdvancedLockCard";
import { HealthLotKpis } from "./HealthLotKpis";
import { VaccinationSection } from "./VaccinationSection";
import { ActiveTreatmentsList } from "./ActiveTreatmentsList";
import { VetVisitsTimeline } from "./VetVisitsTimeline";
import { ObservationsList } from "./ObservationsList";

/**
 * Shared health tab injected into both the broiler lot detail and the layer
 * unit detail. Basic sections (KPIs, vaccination calendar, observations) are
 * always shown when the health module is active; treatments and vet visits are
 * advanced-only and replaced by a CTA when health.advanced is inactive. The
 * frontend only hides — the backend 403 stays the real guard.
 */
export function HealthTab({
  farmId,
  unitId,
  unitName,
  breedId,
  startDate,
  currentCount,
}: {
  farmId: number;
  unitId: number;
  unitName: string;
  breedId: number | null;
  startDate: string;
  currentCount: number;
}) {
  const { hasAdvanced } = useHealthGating();
  const currentUserId = useAppSelector((s) => s.auth.currentUser?.id);
  const currentAgeDays = ageInDays(startDate);

  return (
    <Stack spacing={3}>
      <HealthLotKpis farmId={farmId} unitId={unitId} />

      <VaccinationSection
        farmId={farmId}
        unitId={unitId}
        unitName={unitName}
        breedId={breedId}
        startDate={startDate}
        currentAgeDays={currentAgeDays}
        currentCount={currentCount}
        currentUserId={currentUserId}
      />

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
        }}
      >
        {hasAdvanced ? (
          <ActiveTreatmentsList
            farmId={farmId}
            unitId={unitId}
            unitName={unitName}
            currentCount={currentCount}
            currentUserId={currentUserId}
          />
        ) : (
          <AdvancedLockCard
            farmId={farmId}
            title="Traitements — module avancé"
            description="Enregistrez les traitements et suivez les délais d'attente en activant health.advanced."
          />
        )}

        {hasAdvanced ? (
          <VetVisitsTimeline farmId={farmId} unitId={unitId} unitName={unitName} />
        ) : (
          <AdvancedLockCard
            farmId={farmId}
            title="Vétérinaires — module avancé"
            description="Annuaire et visites vétérinaires disponibles avec health.advanced."
          />
        )}
      </Box>

      <ObservationsList
        farmId={farmId}
        unitId={unitId}
        unitName={unitName}
        currentUserId={currentUserId}
      />
    </Stack>
  );
}
