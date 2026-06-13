"use client";

import { Box, Stack, Tooltip, Typography } from "@mui/material";
import { Check } from "lucide-react";
import {
  ageLabel,
  daysBetween,
  humanizeKey,
  scheduleStatusColor,
  scheduleStatusLabel,
} from "@/lib/health";
import { colors } from "@/theme/tokens";
import type { VaccinationScheduleStatus } from "@/types";

const PX_PER_DAY = 26;
const MARGIN_DAYS = 4;

interface PositionedEntry extends VaccinationScheduleStatus {
  dayOffset: number;
  /** 0 = top row, 1 = bottom row (alternated to avoid overlap). */
  row: number;
}

/**
 * Visual vaccination planning — the critical business view. Horizontal axis is
 * the lot age in days; each programmed dose is positioned at its due date, the
 * vertical green marker is "today (Jn)". Strict status colors:
 * DONE=success, LATE=error, UPCOMING=neutral. Clicking a card opens the
 * vaccination dialog prefilled with that dose.
 */
export function VaccinationCalendar({
  schedule,
  startDate,
  currentAgeDays,
  onSelectEntry,
}: {
  schedule: VaccinationScheduleStatus[];
  startDate: string;
  currentAgeDays: number;
  onSelectEntry?: (entry: VaccinationScheduleStatus) => void;
}) {
  const positioned: PositionedEntry[] = [...schedule]
    .map((e, i) => ({
      ...e,
      dayOffset: Math.max(0, daysBetween(startDate, e.dueDate)),
      row: i % 2,
    }))
    .sort((a, b) => a.dayOffset - b.dayOffset)
    .map((e, i) => ({ ...e, row: i % 2 }));

  const maxDay =
    Math.max(currentAgeDays, ...positioned.map((p) => p.dayOffset), 7) + MARGIN_DAYS;
  const width = maxDay * PX_PER_DAY;
  const ticks = Array.from({ length: Math.floor(maxDay / 7) + 1 }, (_, i) => i * 7);
  const todayLeft = Math.min(currentAgeDays, maxDay) * PX_PER_DAY;

  return (
    <Box>
      {/* Legend */}
      <Stack direction="row" spacing={2} sx={{ mb: 1.5, flexWrap: "wrap" }}>
        {(["DONE", "UPCOMING", "LATE"] as const).map((s) => (
          <Stack key={s} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: scheduleStatusColor(s) }} />
            <Typography variant="caption" color="text.secondary">
              {scheduleStatusLabel(s)}
            </Typography>
          </Stack>
        ))}
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Box sx={{ width: 2, height: 12, bgcolor: colors.primary[500] }} />
          <Typography variant="caption" color="text.secondary">
            Aujourd&apos;hui (J{currentAgeDays})
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ overflowX: "auto", pb: 1 }}>
        <Box sx={{ position: "relative", height: 168, minWidth: width, mx: 1 }}>
          {/* Baseline */}
          <Box
            sx={{
              position: "absolute",
              top: 80,
              left: 0,
              right: 0,
              height: 2,
              bgcolor: colors.neutral[200],
            }}
          />
          {/* Ticks */}
          {ticks.map((d) => (
            <Box key={d} sx={{ position: "absolute", top: 74, left: d * PX_PER_DAY }}>
              <Box sx={{ width: 1, height: 14, bgcolor: colors.neutral[300] }} />
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  top: 16,
                  left: -8,
                  color: colors.neutral[400],
                  fontFamily: "var(--font-mono)",
                }}
              >
                J{d}
              </Typography>
            </Box>
          ))}
          {/* Today marker */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              bottom: 28,
              left: todayLeft,
              width: 2,
              bgcolor: colors.primary[500],
              zIndex: 2,
            }}
          />

          {/* Dose cards */}
          {positioned.map((e, i) => {
            const color = scheduleStatusColor(e.status);
            const top = e.row === 0 ? 8 : 96;
            return (
              <Tooltip
                key={`${e.vaccineKey}-${i}`}
                title={`${humanizeKey(e.vaccineKey)} — ${scheduleStatusLabel(e.status)} (${ageLabel(e.ageValue, e.ageUnit)})`}
              >
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectEntry?.(e)}
                  onKeyDown={(ev) => ev.key === "Enter" && onSelectEntry?.(e)}
                  sx={{
                    position: "absolute",
                    top,
                    left: e.dayOffset * PX_PER_DAY,
                    transform: "translateX(-4px)",
                    width: 110,
                    p: 1,
                    borderRadius: 2,
                    border: `1px solid ${color}`,
                    borderLeft: `4px solid ${color}`,
                    bgcolor: colors.neutral[0],
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                    cursor: "pointer",
                    zIndex: 3,
                    "&:hover": { boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" },
                  }}
                >
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mb: 0.25 }}>
                    {e.status === "DONE" && <Check size={12} color={color} />}
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 700, color, fontFamily: "var(--font-mono)" }}
                    >
                      {ageLabel(e.ageValue, e.ageUnit)}
                    </Typography>
                    {e.mandatory && (
                      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: colors.accent[400] }} />
                    )}
                  </Stack>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      lineHeight: 1.2,
                      color: colors.neutral[700],
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {humanizeKey(e.vaccineKey)}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
