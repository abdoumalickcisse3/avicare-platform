"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { ChevronRight, Lock, Plus } from "lucide-react";
import {
  useGetCollectionsQuery,
  useGetGradesQuery,
  useGetTimeslotsQuery,
} from "@/store/api/eggProductionApi";
import { useGetProductionUnitQuery } from "@/store/api/productionUnitsApi";
import { useGetBreedsQuery } from "@/store/api/breedsApi";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { apiErrorMessage } from "@/lib/apiError";
import { ageInDays, isFeatureForbidden } from "@/lib/poultry";
import { isoDaysAgo, isoToday } from "@/lib/layer";
import { formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { BatchStatusChip } from "@/components/poultry/BatchStatusChip";
import { HealthTab } from "@/components/health/HealthTab";
import { LayerOverviewTab } from "./LayerOverviewTab";
import { LayerCollectionsTab } from "./LayerCollectionsTab";
import { LayerDailyRecordsTab } from "./LayerDailyRecordsTab";
import { LayerFlockTab } from "./LayerFlockTab";
import { CloseDayButton } from "./CloseDayButton";
import { EggCollectionDialog } from "./EggCollectionDialog";

type TabKey = "overview" | "collections" | "records" | "layers" | "health";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "collections", label: "Collectes" },
  { key: "records", label: "Suivi journalier" },
  { key: "layers", label: "Pondeuses" },
  { key: "health", label: "Sanitaire" },
];

function FeatureLock({ farmId, hasFarm }: { farmId?: number; hasFarm: boolean }) {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: 8,
        border: (t) => `1px dashed ${t.palette.divider}`,
        borderRadius: 3,
      }}
    >
      <Box sx={{ color: colors.neutral[400], mb: 1 }}>
        <Lock size={32} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Module Ponte non activé
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Activez le module pour consulter ce lot de pondeuses.
      </Typography>
      {hasFarm && (
        <Button
          component={Link}
          href={`/fermes/${farmId}?tab=subscription`}
          variant="contained"
          color="primary"
        >
          Voir l&apos;abonnement
        </Button>
      )}
    </Box>
  );
}

export function LayerUnitDetailView({ unitId }: { unitId: number }) {
  const { farmId, isLoading: farmLoading, hasFarm } = useSelectedFarm();
  const [tab, setTab] = useState<TabKey>("overview");
  const [collectOpen, setCollectOpen] = useState(false);

  const {
    data: unit,
    isLoading,
    error,
  } = useGetProductionUnitQuery(
    { farmId: farmId as number, unitId },
    { skip: !hasFarm },
  );
  const { data: breeds } = useGetBreedsQuery();
  // Config + recent collections feed the header "Saisir collecte" dialog.
  const { data: timeslotEntries } = useGetTimeslotsQuery(
    { farmId: farmId as number },
    { skip: !hasFarm },
  );
  const { data: gradeEntries } = useGetGradesQuery(
    { farmId: farmId as number },
    { skip: !hasFarm },
  );
  const { data: collections } = useGetCollectionsQuery(
    { farmId: farmId as number, unitId, from: isoDaysAgo(30), to: isoToday() },
    { skip: !hasFarm || !unit },
  );

  if (isFeatureForbidden(error)) {
    return <FeatureLock farmId={farmId} hasFarm={hasFarm} />;
  }

  if (isLoading || farmLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width={240} height={48} />
        <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }

  if (error || !unit) {
    return (
      <Alert severity="error">
        {error ? apiErrorMessage(error) : "Lot introuvable."}
      </Alert>
    );
  }

  const breedName = breeds?.find((b) => b.id === unit.breedId)?.name;
  const title = unit.name || `${breedName ?? "Lot"} #${unit.id}`;
  const week = Math.floor(ageInDays(unit.startDate) / 7) + 1;
  const timeslots = (timeslotEntries ?? []).map((e) => e.key);
  const grades = (gradeEntries ?? []).map((e) => e.key);
  const existingKeys = (collections ?? []).map(
    (c) => `${c.collectionDate}|${c.timeslotKey}`,
  );

  return (
    <Box sx={{ pb: { xs: 9, sm: 0 } }}>
      <Breadcrumbs separator={<ChevronRight size={14} />} sx={{ mb: 1.5 }}>
        <Link
          href="/elevage/oeufs"
          style={{ color: colors.neutral[500], textDecoration: "none" }}
        >
          Œufs
        </Link>
        <Typography variant="body2" color="text.primary">
          {title}
        </Typography>
      </Breadcrumbs>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <BatchStatusChip status={unit.status} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {breedName ?? "Souche inconnue"} · Semaine {week} ·{" "}
            <Box
              component="span"
              sx={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}
            >
              {formatNumber(unit.currentCount)}
            </Box>{" "}
            pondeuses
          </Typography>
        </Box>
        {unit.status === "ACTIVE" && (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <CloseDayButton farmId={farmId as number} unitId={unit.id} />
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<Plus size={20} />}
              onClick={() => setCollectOpen(true)}
              sx={{ fontWeight: 700, boxShadow: 3, display: { xs: "none", sm: "inline-flex" } }}
            >
              Saisir collecte
            </Button>
          </Stack>
        )}
      </Stack>

      <Tabs
        value={tab}
        onChange={(_e, v: TabKey) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}
      >
        {TABS.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} />
        ))}
      </Tabs>

      {tab === "overview" && <LayerOverviewTab farmId={farmId as number} unit={unit} />}
      {tab === "collections" && (
        <LayerCollectionsTab farmId={farmId as number} unit={unit} />
      )}
      {tab === "records" && <LayerDailyRecordsTab farmId={farmId as number} unit={unit} />}
      {tab === "layers" && <LayerFlockTab farmId={farmId as number} unit={unit} />}
      {tab === "health" && (
        <HealthTab
          farmId={farmId as number}
          unitId={unit.id}
          unitName={title}
          breedId={unit.breedId}
          startDate={unit.startDate}
          currentCount={unit.currentCount}
        />
      )}

      <EggCollectionDialog
        open={collectOpen}
        onClose={() => setCollectOpen(false)}
        farmId={farmId as number}
        unitId={unit.id}
        unitName={title}
        timeslots={timeslots}
        grades={grades}
        existingKeys={existingKeys}
      />
    </Box>
  );
}
