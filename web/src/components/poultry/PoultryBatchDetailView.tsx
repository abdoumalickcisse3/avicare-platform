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
  useGetBatchQuery,
  useGetDailyRecordsQuery,
} from "@/store/api/poultryBatchesApi";
import { useGetBreedsQuery } from "@/store/api/breedsApi";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { apiErrorMessage } from "@/lib/apiError";
import { ageInDays, isFeatureForbidden } from "@/lib/poultry";
import { formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { BatchStatusChip } from "./BatchStatusChip";
import { BatchOverviewTab } from "./BatchOverviewTab";
import { DailyRecordsTab } from "./DailyRecordsTab";
import { WeighingsTab } from "./WeighingsTab";
import { HealthTab } from "@/components/health/HealthTab";
import { DailyRecordDialog } from "./DailyRecordDialog";

type TabKey = "overview" | "records" | "weighings" | "health";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "records", label: "Saisies" },
  { key: "weighings", label: "Pesées" },
  { key: "health", label: "Sanitaire" },
];

export function PoultryBatchDetailView({ batchId }: { batchId: number }) {
  const { farmId, isLoading: farmLoading, hasFarm } = useSelectedFarm();
  const [tab, setTab] = useState<TabKey>("overview");
  const [recordOpen, setRecordOpen] = useState(false);

  const {
    data: batch,
    isLoading,
    error,
  } = useGetBatchQuery({ farmId: farmId as number, batchId }, { skip: !hasFarm });
  const { data: breeds } = useGetBreedsQuery();
  // Shared cache with the Saisies tab — used for the existing-date warning.
  const { data: records } = useGetDailyRecordsQuery(
    { farmId: farmId as number, batchId },
    { skip: !hasFarm || !batch },
  );

  const breedName = breeds?.find((b) => b.id === batch?.breedId)?.name;
  const featureLocked = isFeatureForbidden(error);

  if (featureLocked) {
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
          Module Volaille chair non activé
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Activez le module pour consulter ce lot.
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

  if (isLoading || farmLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="text" width={240} height={48} />
        <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }

  if (error || !batch) {
    return (
      <Alert severity="error">
        {error ? apiErrorMessage(error) : "Lot introuvable."}
      </Alert>
    );
  }

  const title = batch.name || `${breedName ?? "Lot"} #${batch.id}`;

  return (
    <Box sx={{ pb: { xs: 9, sm: 0 } }}>
      <Breadcrumbs separator={<ChevronRight size={14} />} sx={{ mb: 1.5 }}>
        <Link
          href="/elevage/lots"
          style={{ color: colors.neutral[500], textDecoration: "none" }}
        >
          Lots
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
            <BatchStatusChip status={batch.status} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {breedName ?? "Souche inconnue"} · Jour {ageInDays(batch.startDate)} ·{" "}
            <Box
              component="span"
              sx={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}
            >
              {formatNumber(batch.currentCount)}
            </Box>{" "}
            sujets
          </Typography>
        </Box>
        {batch.status === "ACTIVE" && (
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<Plus size={20} />}
            onClick={() => setRecordOpen(true)}
            sx={{ fontWeight: 700, boxShadow: 3, display: { xs: "none", sm: "inline-flex" } }}
          >
            Nouvelle saisie
          </Button>
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

      {tab === "overview" && <BatchOverviewTab farmId={farmId as number} batch={batch} />}
      {tab === "records" && <DailyRecordsTab farmId={farmId as number} batch={batch} />}
      {tab === "weighings" && <WeighingsTab farmId={farmId as number} batch={batch} />}
      {tab === "health" && (
        <HealthTab
          farmId={farmId as number}
          unitId={batch.id}
          unitName={title}
          breedId={batch.breedId}
          startDate={batch.startDate}
          currentCount={batch.currentCount}
        />
      )}

      {/* Quick mortality entry — the FARMER's most-used action, reachable everywhere. */}
      <DailyRecordDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        farmId={farmId as number}
        batchId={batch.id}
        currentCount={batch.currentCount}
        existingDates={(records ?? []).map((r) => r.recordDate)}
      />
    </Box>
  );
}
