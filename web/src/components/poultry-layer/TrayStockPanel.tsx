"use client";

import { useState } from "react";
import { Box, Button, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import { Layers, SlidersHorizontal } from "lucide-react";
import { useGetTrayStockQuery } from "@/store/api/eggProductionApi";
import { formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { TrayStockDialog } from "./TrayStockDialog";

const monoSx = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
} as const;

function TrayTile({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: colors.neutral[50],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: 2,
        p: 2,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
        <Layers size={16} color={tint} />
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Stack>
      <Typography sx={{ ...monoSx, fontSize: "1.75rem", color: colors.neutral[800] }}>
        {formatNumber(value)}
      </Typography>
    </Box>
  );
}

export function TrayStockPanel({ farmId }: { farmId: number }) {
  const [open, setOpen] = useState(false);
  const { data: stock, isLoading } = useGetTrayStockQuery({ farmId });

  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Stock de plateaux
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Plateaux pleins et vides disponibles.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<SlidersHorizontal size={18} />}
            onClick={() => setOpen(true)}
            sx={{ flexShrink: 0 }}
          >
            Ajuster le stock
          </Button>
        </Stack>

        {isLoading ? (
          <Skeleton variant="rectangular" height={96} sx={{ borderRadius: 2 }} />
        ) : (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TrayTile label="Plateaux pleins" value={stock?.fullTraysCount ?? 0} tint={colors.primary[500]} />
            <TrayTile label="Plateaux vides" value={stock?.emptyTraysCount ?? 0} tint={colors.neutral[400]} />
          </Stack>
        )}
      </CardContent>

      <TrayStockDialog
        open={open}
        onClose={() => setOpen(false)}
        farmId={farmId}
        current={stock}
      />
    </Card>
  );
}
