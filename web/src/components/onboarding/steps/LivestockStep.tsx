"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { Bird, Egg, Info, Plus } from "lucide-react";
import { colors, radii } from "@/theme/tokens";
import { useGetBreedsQuery } from "@/store/api/breedsApi";
import { useGetMyFarmsQuery } from "@/store/api/farmsApi";
import { useGetBatchesQuery } from "@/store/api/poultryBatchesApi";
import { useGetProductionUnitsQuery } from "@/store/api/productionUnitsApi";
import { CreateBatchDialog } from "@/components/poultry/CreateBatchDialog";
import { CreateLayerBatchDialog } from "@/components/poultry-layer/CreateLayerBatchDialog";
import { useWizard } from "../wizardContext";
import { StepHeader } from "./StepHeader";

/**
 * Élevage: the owner adds their first lot(s) — a batch is required to actually
 * manage production. Broiler-only or layer-only farms must add at least one lot
 * of that kind before continuing; mixed farms add broiler and/or layer lots at
 * will. Reuses the same create dialogs as the dashboard.
 */
export function LivestockStep() {
  const { farmId, setCanAdvance } = useWizard();
  const { data: farms } = useGetMyFarmsQuery();
  const { data: breeds } = useGetBreedsQuery({ species: "POULTRY" });
  const { data: batches, isLoading: batchesLoading } = useGetBatchesQuery(
    farmId ? { farmId } : ({} as never),
    { skip: !farmId },
  );
  const { data: units, isLoading: unitsLoading } = useGetProductionUnitsQuery(
    farmId ? { farmId } : ({} as never),
    { skip: !farmId },
  );

  const [broilerOpen, setBroilerOpen] = useState(false);
  const [layerOpen, setLayerOpen] = useState(false);

  const focus = useMemo(
    () => farms?.find((f) => f.id === farmId)?.productionFocus ?? ["broiler", "layer"],
    [farms, farmId],
  );
  const wantsBroiler = focus.includes("broiler");
  const wantsLayer = focus.includes("layer");
  const isMixed = wantsBroiler && wantsLayer;

  // Layer flocks live in the generic production-units list; identify them by
  // their breed type (broiler batches come from the dedicated batches list).
  const layerBreedIds = useMemo(
    () => new Set((breeds ?? []).filter((b) => b.type === "layer").map((b) => b.id)),
    [breeds],
  );
  const layerFlocks = useMemo(
    () => (units ?? []).filter((u) => u.breedId != null && layerBreedIds.has(u.breedId)),
    [units, layerBreedIds],
  );
  const broilerBatches = batches ?? [];

  // Gate: non-mixed farms need at least one lot of their kind. Mixed is optional.
  const satisfied = isMixed
    ? true
    : wantsBroiler
      ? broilerBatches.length > 0
      : layerFlocks.length > 0;

  useEffect(() => {
    setCanAdvance(satisfied);
  }, [satisfied, setCanAdvance]);

  const loading = batchesLoading || unitsLoading;

  return (
    <Box>
      <StepHeader
        eyebrow="Étape 3 · Élevage"
        title="Ajoutez votre premier lot"
        subtitle={
          isMixed
            ? "Créez vos lots de chair et de ponte, comme vous le souhaitez."
            : "Un lot est nécessaire pour suivre votre production — ajoutez-en au moins un."
        }
      />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={26} sx={{ color: colors.primary[500] }} />
        </Box>
      ) : (
        <Stack spacing={2.5}>
          {wantsBroiler && (
            <LotSection
              icon={Bird}
              tint={colors.primary[600]}
              tintBg={colors.primary[50]}
              title="Poulets de chair"
              lots={broilerBatches.map((b) => ({
                id: b.id,
                name: b.name ?? `Lot #${b.id}`,
                count: b.currentCount,
              }))}
              onAdd={() => setBroilerOpen(true)}
              required={!isMixed}
            />
          )}
          {wantsLayer && (
            <LotSection
              icon={Egg}
              tint={colors.accent[500]}
              tintBg={colors.accent[50]}
              title="Poules pondeuses"
              lots={layerFlocks.map((u) => ({
                id: u.id,
                name: u.name ?? `Lot #${u.id}`,
                count: u.currentCount,
              }))}
              onAdd={() => setLayerOpen(true)}
              required={!isMixed}
            />
          )}
        </Stack>
      )}

      {farmId != null && (
        <>
          <CreateBatchDialog open={broilerOpen} onClose={() => setBroilerOpen(false)} farmId={farmId} />
          <CreateLayerBatchDialog open={layerOpen} onClose={() => setLayerOpen(false)} farmId={farmId} />
        </>
      )}
    </Box>
  );
}

function LotSection({
  icon: Icon,
  tint,
  tintBg,
  title,
  lots,
  onAdd,
  required,
}: {
  icon: typeof Bird;
  tint: string;
  tintBg: string;
  title: string;
  lots: { id: number; name: string; count: number }[];
  onAdd: () => void;
  required: boolean;
}) {
  const empty = lots.length === 0;
  return (
    <Box
      sx={{
        p: 2.5,
        bgcolor: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: radii.lg,
      }}
    >
      <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, mb: empty ? 1.5 : 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: radii.md,
            bgcolor: tintBg,
            color: tint,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={20} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, color: colors.neutral[800] }}>{title}</Typography>
          <Typography sx={{ fontSize: 13, color: colors.neutral[500] }}>
            {lots.length} lot{lots.length > 1 ? "s" : ""}
          </Typography>
        </Box>
        <Button
          onClick={onAdd}
          startIcon={<Plus size={16} />}
          sx={{
            color: colors.primary[700],
            fontWeight: 700,
            bgcolor: colors.primary[50],
            "&:hover": { bgcolor: colors.primary[100] },
          }}
        >
          Ajouter
        </Button>
      </Stack>

      {empty ? (
        required ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: colors.accent[600] }}>
            <Info size={15} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>
              Ajoutez au moins un lot pour continuer.
            </Typography>
          </Stack>
        ) : (
          <Typography sx={{ fontSize: 13.5, color: colors.neutral[400] }}>
            Aucun lot pour l&apos;instant.
          </Typography>
        )
      ) : (
        <Stack spacing={1}>
          {lots.map((l) => (
            <Stack
              key={l.id}
              direction="row"
              sx={{
                alignItems: "center",
                justifyContent: "space-between",
                px: 1.5,
                py: 1,
                bgcolor: colors.neutral[50],
                borderRadius: radii.md,
              }}
            >
              <Typography sx={{ fontWeight: 600, color: colors.neutral[800] }}>{l.name}</Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 13,
                  color: colors.neutral[600],
                }}
              >
                {l.count.toLocaleString("fr-FR")} têtes
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}
