"use client";

import { useState } from "react";
import { Button, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import { HeartCrack, LogOut } from "lucide-react";
import { format, parseISO } from "date-fns";
import { summarizeAttrition } from "@/lib/flock";
import { formatNumber } from "@/lib/format";
import { ageInDays } from "@/lib/poultry";
import { colors } from "@/theme/tokens";
import type { LifecycleEvent } from "@/types";
import { useFarmPermissions } from "@/hooks/useFarmPermissions";
import { LayerFlockEventDialog } from "./LayerFlockEventDialog";

const mono = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
} as const;

function Row({
  label,
  value,
  tint,
  strong,
}: {
  label: string;
  value: string;
  tint?: string;
  strong?: boolean;
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
      <Typography variant="body2" sx={{ color: tint ?? colors.neutral[600] }}>
        {label}
      </Typography>
      <Typography sx={{ ...mono, fontWeight: strong ? 700 : 500, color: tint ?? colors.neutral[800] }}>
        {value}
      </Typography>
    </Stack>
  );
}

export function FlockAttritionPanel({
  farmId,
  unitId,
  status,
  currentCount,
  events,
  onsetDate,
}: {
  farmId: number;
  unitId: number;
  status: string;
  currentCount: number;
  events: LifecycleEvent[];
  onsetDate: string | null;
}) {
  const [dialog, setDialog] = useState<null | "mortality" | "reform">(null);
  const { can } = useFarmPermissions(farmId);
  const canWrite = can("poultry:write");
  const a = summarizeAttrition(events);

  const onsetLabel =
    onsetDate != null
      ? `S.${Math.floor(ageInDays(onsetDate) / 7) + 1} · ${format(parseISO(onsetDate), "dd/MM/yyyy")}`
      : "—";

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Attrition
        </Typography>
        <Stack spacing={1}>
          <Row label="Initial" value={formatNumber(a.initial)} />
          <Row label="− Mortalité" value={formatNumber(a.mortality)} tint={colors.error.main} />
          <Row label="− Réforme" value={formatNumber(a.reform)} tint={colors.warning.main} />
          <Divider />
          <Row label="= Effectif" value={formatNumber(currentCount)} strong />
          <Row label="Attrition" value={`${a.attritionPct.toFixed(1)} %`} />
          <Row label="Entrée en ponte" value={onsetLabel} />
        </Stack>

        {status === "ACTIVE" && canWrite && (
          <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<HeartCrack size={16} />}
              onClick={() => setDialog("mortality")}
            >
              Mortalité
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              startIcon={<LogOut size={16} />}
              onClick={() => setDialog("reform")}
            >
              Réforme
            </Button>
          </Stack>
        )}
      </CardContent>

      {dialog && (
        <LayerFlockEventDialog
          open
          onClose={() => setDialog(null)}
          farmId={farmId}
          unitId={unitId}
          mode={dialog}
          currentCount={currentCount}
        />
      )}
    </Card>
  );
}
