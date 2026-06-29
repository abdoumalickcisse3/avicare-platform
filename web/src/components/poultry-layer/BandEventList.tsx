"use client";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { format, parseISO } from "date-fns";
import { colors } from "@/theme/tokens";
import type { LifecycleEvent } from "@/types";

const mono = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
} as const;

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Création",
  MORTALITY: "Mortalité",
  REFORM: "Réforme",
  COUNT_ADJUSTMENT: "Ajustement",
  SALE: "Vente",
  SALE_CANCEL: "Annulation vente",
};

function deltaColor(delta: number): string {
  if (delta > 0) return colors.success.main;
  if (delta < 0) return colors.error.main;
  return colors.neutral[500];
}

export function BandEventList({ events }: { events: LifecycleEvent[] }) {
  const sorted = [...events].sort((a, b) =>
    a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0,
  );

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
          Historique de bande
        </Typography>
        {sorted.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Aucun événement enregistré.
          </Typography>
        ) : (
          <Stack divider={<Box sx={{ borderBottom: `1px solid ${colors.neutral[100]}` }} />}>
            {sorted.map((e) => (
              <Stack
                key={e.id}
                direction="row"
                spacing={2}
                sx={{ alignItems: "center", py: 1 }}
              >
                <Typography variant="body2" sx={{ ...mono, color: colors.neutral[500], width: 84 }}>
                  {format(parseISO(e.occurredAt), "dd/MM/yyyy")}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                  {EVENT_LABELS[e.eventType] ?? e.eventType}
                </Typography>
                <Typography sx={{ ...mono, fontWeight: 700, color: deltaColor(e.quantityDelta), width: 64, textAlign: "right" }}>
                  {e.quantityDelta > 0 ? `+${e.quantityDelta}` : e.quantityDelta}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {e.reason ?? ""}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
