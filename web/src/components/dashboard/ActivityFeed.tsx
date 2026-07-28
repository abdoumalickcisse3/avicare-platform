"use client";

import {
  Activity as ActivityIcon,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Egg,
  Eye,
  HeartPulse,
  type LucideIcon,
  PlusCircle,
  Pill,
  Scale,
  ShoppingCart,
  Stethoscope,
  Syringe,
  Wallet,
  XCircle,
} from "lucide-react";
import { Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { colors } from "@/theme/tokens";
import { useGetFarmActivityQuery } from "@/store/api/activityApi";
import type { ActivityItem } from "@/types";

/** kind → icon + tint. Kinds mirror the backend lifecycle event types + SALE/PAYMENT. */
const KIND_STYLE: Record<string, { icon: LucideIcon; tint: string }> = {
  MORTALITY: { icon: HeartPulse, tint: colors.error.main },
  SALE_CANCEL: { icon: XCircle, tint: colors.error.main },
  VACCINATION_ADMINISTERED: { icon: Syringe, tint: colors.success.main },
  TREATMENT_ADMINISTERED: { icon: Pill, tint: colors.vet.main },
  VET_VISIT_RECORDED: { icon: Stethoscope, tint: colors.vet.main },
  HEALTH_OBSERVATION: { icon: Eye, tint: colors.warning.main },
  SALE: { icon: ShoppingCart, tint: colors.accent[400] },
  PAYMENT: { icon: Wallet, tint: colors.success.main },
  EGG_COLLECTION: { icon: Egg, tint: colors.primary[500] },
  DAILY_RECORD: { icon: ClipboardList, tint: colors.info.main },
  DAILY_PRODUCTION_CLOSED: { icon: CheckCircle2, tint: colors.success.main },
  COUNT_ADJUSTMENT: { icon: Scale, tint: colors.neutral[500] },
  CREATED: { icon: PlusCircle, tint: colors.primary[500] },
  PROGRAM_ASSIGNED: { icon: CalendarCheck, tint: colors.info.main },
  PROGRAM_REMOVED: { icon: CalendarCheck, tint: colors.neutral[500] },
};

function styleFor(kind: string) {
  return KIND_STYLE[kind] ?? { icon: ActivityIcon, tint: colors.neutral[500] };
}

/** Compact French relative time from an ISO timestamp. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

interface ActivityFeedProps {
  farmId: number;
}

/**
 * "Activité récente" — the farm's latest lifecycle & commercial events, styled
 * after the Avicare Design System (Stitch): a tinted icon disc per event, its
 * label, an optional detail line, and a relative timestamp.
 */
export function ActivityFeed({ farmId }: ActivityFeedProps) {
  const { data, isLoading } = useGetFarmActivityQuery({ farmId, limit: 8 });

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "1rem" }}>Activité récente</Typography>
        </Stack>

        {isLoading ? (
          <Stack spacing={2}>
            {[0, 1, 2, 3].map((i) => (
              <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Skeleton variant="circular" width={36} height={36} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="70%" />
                  <Skeleton variant="text" width="40%" />
                </Box>
              </Stack>
            ))}
          </Stack>
        ) : !data || data.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Aucune activité récente sur cette ferme.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2.25}>
            {data.map((item: ActivityItem, i: number) => {
              const { icon: Icon, tint } = styleFor(item.kind);
              return (
                <Stack key={`${item.kind}-${item.at}-${i}`} direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
                  <Box
                    aria-hidden
                    sx={{
                      mt: 0.25,
                      width: 36,
                      height: 36,
                      flexShrink: 0,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(tint, 0.12),
                      color: tint,
                    }}
                  >
                    <Icon size={17} strokeWidth={2.2} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                      {item.label}
                    </Typography>
                    {item.detail && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {item.detail}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>
                      {relativeTime(item.at)}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
