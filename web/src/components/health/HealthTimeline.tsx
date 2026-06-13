"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Card,
  Chip,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Eye, Pill, Stethoscope, Syringe } from "lucide-react";
import { formatDate } from "@/lib/format";
import { humanizeKey } from "@/lib/health";
import { colors } from "@/theme/tokens";
import type { HealthAlerts } from "@/types";

type EventKind = "vaccination" | "treatment" | "observation" | "vet-visit";

interface TimelineEvent {
  kind: EventKind;
  unitId: number;
  title: string;
  subtitle: string;
  date: string;
  color: string;
  icon: React.ReactNode;
}

const KIND_META: Record<EventKind, { label: string; color: string }> = {
  vaccination: { label: "Vaccins", color: colors.error.main },
  treatment: { label: "Traitements", color: colors.info.main },
  observation: { label: "Observations", color: colors.warning.main },
  "vet-visit": { label: "Visites", color: colors.vet.main },
};

/**
 * Recent health events for the farm, built from the consolidated alerts
 * (compute-on-read — no dedicated events table in V1). Filterable by type.
 */
export function HealthTimeline({
  alerts,
  isLoading,
  unitName,
}: {
  alerts?: HealthAlerts;
  isLoading: boolean;
  unitName: (unitId: number) => string;
}) {
  const [filter, setFilter] = useState<EventKind | "all">("all");

  const events = useMemo<TimelineEvent[]>(() => {
    if (!alerts) return [];
    const out: TimelineEvent[] = [];
    for (const v of alerts.vaccinationsLate) {
      out.push({
        kind: "vaccination",
        unitId: v.unitId,
        title: `Vaccin ${humanizeKey(v.vaccineKey)} en retard`,
        subtitle: `${unitName(v.unitId)} · ${v.daysLate} j de retard`,
        date: v.dueDate,
        color: colors.error.main,
        icon: <Syringe size={16} />,
      });
    }
    for (const o of alerts.criticalObservations) {
      out.push({
        kind: "observation",
        unitId: o.unitId,
        title: o.title,
        subtitle: `${unitName(o.unitId)} · ${o.severity === "CRITICAL" ? "Critique" : "Vigilance"}`,
        date: o.observationDate,
        color: colors.warning.main,
        icon: <Eye size={16} />,
      });
    }
    for (const w of alerts.activeWithdrawals) {
      out.push({
        kind: "treatment",
        unitId: w.unitId,
        title: `Délai d'attente · ${humanizeKey(w.treatmentKey)}`,
        subtitle: `${unitName(w.unitId)} · viande J-${w.daysRemainingMeat ?? "?"} / œufs J-${w.daysRemainingEggs ?? "?"}`,
        date: w.withdrawalEndDateMeat ?? w.withdrawalEndDateEggs ?? "",
        color: colors.info.main,
        icon: <Pill size={16} />,
      });
    }
    for (const f of alerts.upcomingFollowUps) {
      out.push({
        kind: "vet-visit",
        unitId: f.unitId,
        title: "Suivi vétérinaire programmé",
        subtitle: `${unitName(f.unitId)} · dans ${f.daysUntil} j`,
        date: f.followUpDate,
        color: colors.vet.main,
        icon: <Stethoscope size={16} />,
      });
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [alerts, unitName]);

  const visible = filter === "all" ? events : events.filter((e) => e.kind === filter);

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 2 }}
      >
        <Typography sx={{ fontWeight: 700 }}>Historique sanitaire récent</Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_, v) => v && setFilter(v)}
        >
          <ToggleButton value="all">Tout</ToggleButton>
          {(Object.keys(KIND_META) as EventKind[]).map((k) => (
            <ToggleButton key={k} value={k}>
              {KIND_META[k].label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {isLoading ? (
        <Stack spacing={1}>
          <Skeleton variant="rounded" height={48} />
          <Skeleton variant="rounded" height={48} />
          <Skeleton variant="rounded" height={48} />
        </Stack>
      ) : visible.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
          Aucun événement à signaler. Tout est à jour.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {visible.map((e, i) => (
            <Stack
              key={`${e.kind}-${e.unitId}-${i}`}
              direction="row"
              spacing={1.5}
              sx={{
                alignItems: "center",
                p: 1.25,
                border: `1px solid ${colors.neutral[200]}`,
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: `${e.color}1A`,
                  color: e.color,
                }}
              >
                {e.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }} noWrap>
                  {e.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {e.subtitle}
                </Typography>
              </Box>
              {e.date && (
                <Chip
                  size="small"
                  label={formatDate(e.date)}
                  sx={{ fontFamily: "var(--font-mono)", bgcolor: colors.neutral[100] }}
                />
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Card>
  );
}
