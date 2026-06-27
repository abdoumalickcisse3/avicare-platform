"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { CalendarDays } from "lucide-react";
import type { DashboardPeriodState, PeriodPreset } from "@/types/dashboard";
import { PERIOD_PRESETS } from "@/lib/dashboard";

interface PeriodSelectorProps {
  value: DashboardPeriodState;
  onChange: (next: DashboardPeriodState) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const [customOpen, setCustomOpen] = useState(value.kind === "custom");

  function handlePreset(
    _event: React.MouseEvent<HTMLElement>,
    preset: PeriodPreset | null,
  ) {
    if (!preset) return; // ToggleButtonGroup can return null on deselect
    setCustomOpen(false);
    onChange({ kind: "preset", preset });
  }

  function handleCustomToggle() {
    const next = !customOpen;
    setCustomOpen(next);
    if (!next) {
      // Revert to default preset when closing custom panel
      onChange({ kind: "preset", preset: value.preset ?? "30d" });
    }
  }

  function handleDateChange(field: "from" | "to", dateValue: string) {
    const from = field === "from" ? dateValue : value.from ?? "";
    const to = field === "to" ? dateValue : value.to ?? "";
    if (from && to) {
      onChange({ kind: "custom", from, to });
    }
  }

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={value.kind === "preset" ? (value.preset ?? "30d") : null}
        onChange={handlePreset}
        aria-label="Période"
      >
        {PERIOD_PRESETS.map((p) => (
          <ToggleButton key={p.value} value={p.value}>
            {p.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Button
        size="small"
        variant={customOpen ? "contained" : "outlined"}
        startIcon={<CalendarDays size={16} />}
        onClick={handleCustomToggle}
      >
        Perso…
      </Button>

      <Collapse in={customOpen} orientation="horizontal" unmountOnExit>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            type="date"
            size="small"
            label="Du"
            value={value.from ?? ""}
            onChange={(e) => handleDateChange("from", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="date"
            size="small"
            label="Au"
            value={value.to ?? ""}
            onChange={(e) => handleDateChange("to", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
      </Collapse>
    </Stack>
  );
}
