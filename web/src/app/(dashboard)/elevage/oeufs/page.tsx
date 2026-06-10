"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Fab, Skeleton, Stack, Typography } from "@mui/material";
import { Bird, Egg, Layers, Lock, Plus } from "lucide-react";
import { useGetProductionUnitsQuery } from "@/store/api/productionUnitsApi";
import { useGetBatchesQuery } from "@/store/api/poultryBatchesApi";
import { useGetBreedsQuery } from "@/store/api/breedsApi";
import { useGetTrayStockQuery } from "@/store/api/eggProductionApi";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { apiErrorMessage } from "@/lib/apiError";
import { isFeatureForbidden } from "@/lib/poultry";
import { selectLayerUnits } from "@/lib/layer";
import { formatNumber } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { LayerKpiCard } from "@/components/poultry-layer/LayerKpiCard";
import { LayerUnitSummaryCard } from "@/components/poultry-layer/LayerUnitSummaryCard";
import { TrayStockPanel } from "@/components/poultry-layer/TrayStockPanel";
import { CreateLayerBatchDialog } from "@/components/poultry-layer/CreateLayerBatchDialog";

const GRID_SX = {
  display: "grid",
  gap: { xs: 2, md: 3 },
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
} as const;

export default function EggProductionPage() {
  const { farmId, isLoading: farmLoading, hasFarm } = useSelectedFarm();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: units, isLoading: unitsLoading } = useGetProductionUnitsQuery(
    { farmId: farmId as number },
    { skip: !hasFarm },
  );
  const { data: batches } = useGetBatchesQuery(
    { farmId: farmId as number },
    { skip: !hasFarm },
  );
  const { data: breeds } = useGetBreedsQuery();
  // tray-stock is gated by module.poultry.layer — its 403 is our feature lock signal.
  const { data: trayStock, error: trayError } = useGetTrayStockQuery(
    { farmId: farmId as number },
    { skip: !hasFarm },
  );

  const breedNames = useMemo(
    () => Object.fromEntries((breeds ?? []).map((b) => [b.id, b.name])),
    [breeds],
  );

  const layerUnits = useMemo(() => {
    if (!units) return [];
    const broilerIds = new Set((batches ?? []).map((b) => b.id));
    return selectLayerUnits(units, broilerIds);
  }, [units, batches]);

  const featureLocked = isFeatureForbidden(trayError);
  const activeCount = layerUnits.filter((u) => u.status === "ACTIVE").length;
  const flock = layerUnits.reduce((s, u) => s + u.currentCount, 0);

  return (
    <Box sx={{ pb: { xs: 9, sm: 0 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Production d&apos;œufs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Suivez la ponte, les collectes et le stock de plateaux.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Plus size={18} />}
          onClick={() => setCreateOpen(true)}
          disabled={!hasFarm || featureLocked}
          sx={{ display: { xs: "none", sm: "inline-flex" } }}
        >
          Nouveau lot de pondeuses
        </Button>
      </Stack>

      {!hasFarm && !farmLoading && (
        <Alert severity="info">
          Créez d&apos;abord une ferme pour suivre la ponte.
        </Alert>
      )}

      {featureLocked && hasFarm && (
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
            Activez le module pour suivre la production d&apos;œufs.
          </Typography>
          <Button
            component={Link}
            href={`/fermes/${farmId}?tab=subscription`}
            variant="contained"
            color="primary"
          >
            Voir l&apos;abonnement
          </Button>
        </Box>
      )}

      {!featureLocked && trayError && (
        <Alert severity="error">{apiErrorMessage(trayError)}</Alert>
      )}

      {hasFarm && !featureLocked && (
        <Stack spacing={3}>
          <Box
            sx={{
              display: "grid",
              gap: { xs: 2, md: 3 },
              gridTemplateColumns: { xs: "1fr 1fr", lg: "repeat(4, 1fr)" },
            }}
          >
            <LayerKpiCard
              label="Lots en ponte"
              value={activeCount}
              unit="actifs"
              icon={<Egg size={20} />}
              tint={colors.primary[500]}
            />
            <LayerKpiCard
              label="Cheptel pondeuses"
              value={formatNumber(flock)}
              unit="sujets"
              icon={<Bird size={20} />}
              tint={colors.info.main}
            />
            <LayerKpiCard
              label="Plateaux pleins"
              value={formatNumber(trayStock?.fullTraysCount ?? 0)}
              icon={<Layers size={20} />}
              tint={colors.success.main}
            />
            <LayerKpiCard
              label="Plateaux vides"
              value={formatNumber(trayStock?.emptyTraysCount ?? 0)}
              icon={<Layers size={20} />}
              tint={colors.neutral[400]}
            />
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Lots en production
            </Typography>
            {unitsLoading || farmLoading ? (
              <Box sx={GRID_SX}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="rectangular" height={180} sx={{ borderRadius: 3 }} />
                ))}
              </Box>
            ) : layerUnits.length === 0 ? (
              <Box
                sx={{
                  textAlign: "center",
                  py: 6,
                  border: (t) => `1px dashed ${t.palette.divider}`,
                  borderRadius: 3,
                }}
              >
                <Box sx={{ color: colors.neutral[400], mb: 1 }}>
                  <Egg size={32} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Aucun lot de pondeuses
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Créez votre premier lot de pondeuses pour démarrer le suivi.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Plus size={18} />}
                  onClick={() => setCreateOpen(true)}
                >
                  Nouveau lot de pondeuses
                </Button>
              </Box>
            ) : (
              <Box sx={GRID_SX}>
                {layerUnits.map((u) => (
                  <LayerUnitSummaryCard
                    key={u.id}
                    farmId={farmId as number}
                    unit={u}
                    breedName={breedNames[u.breedId ?? -1]}
                  />
                ))}
              </Box>
            )}
          </Box>

          <TrayStockPanel farmId={farmId as number} />
        </Stack>
      )}

      {/* Mobile FAB — quick layer-lot creation on the go */}
      {hasFarm && !featureLocked && (
        <Fab
          color="primary"
          aria-label="Nouveau lot de pondeuses"
          onClick={() => setCreateOpen(true)}
          sx={{ position: "fixed", bottom: 24, right: 24, display: { xs: "flex", sm: "none" } }}
        >
          <Plus size={24} />
        </Fab>
      )}

      {farmId && (
        <CreateLayerBatchDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          farmId={farmId}
        />
      )}
    </Box>
  );
}
