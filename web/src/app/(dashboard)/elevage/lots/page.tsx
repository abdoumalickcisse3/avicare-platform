"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Fab,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { LayoutGrid, List as ListIcon, Lock, Plus, Search } from "lucide-react";
import { useGetBatchesQuery } from "@/store/api/poultryBatchesApi";
import { useGetBreedsQuery } from "@/store/api/breedsApi";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { apiErrorMessage } from "@/lib/apiError";
import { isFeatureForbidden } from "@/lib/poultry";
import { PoultryBatchCard } from "@/components/poultry/PoultryBatchCard";
import { PoultryBatchesTable } from "@/components/poultry/PoultryBatchesTable";
import { CreateBatchDialog } from "@/components/poultry/CreateBatchDialog";
import type { BatchStatus } from "@/types";
import { colors } from "@/theme/tokens";

type FilterKey = "all" | "ACTIVE" | "CLOSED";

const FILTERS: { key: FilterKey; label: string; status?: BatchStatus }[] = [
  { key: "all", label: "Tous" },
  { key: "ACTIVE", label: "Actifs", status: "ACTIVE" },
  { key: "CLOSED", label: "Clôturés", status: "CLOSED" },
];

const GRID_SX = {
  display: "grid",
  gap: { xs: 2, md: 3 },
  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
} as const;

export default function PoultryBatchesPage() {
  const { farmId, isLoading: farmLoading, hasFarm } = useSelectedFarm();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const status = FILTERS.find((f) => f.key === filter)?.status;
  const {
    data: batches,
    isLoading,
    error,
  } = useGetBatchesQuery({ farmId: farmId as number, status }, { skip: !hasFarm });
  const { data: breeds } = useGetBreedsQuery();

  const breedNames = useMemo(
    () => Object.fromEntries((breeds ?? []).map((b) => [b.id, b.name])),
    [breeds],
  );

  const filtered = useMemo(() => {
    if (!batches) return [];
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter(
      (b) =>
        (b.name ?? "").toLowerCase().includes(q) ||
        (breedNames[b.breedId] ?? "").toLowerCase().includes(q),
    );
  }, [batches, search, breedNames]);

  const featureLocked = isFeatureForbidden(error);

  return (
    <Box sx={{ pb: { xs: 9, sm: 0 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Lots de volaille chair
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gérez et suivez la performance de vos productions en cours.
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
          Nouveau lot
        </Button>
      </Stack>

      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Tabs value={filter} onChange={(_e, v: FilterKey) => setFilter(v)}>
          {FILTERS.map((f) => (
            <Tab key={f.key} value={f.key} label={f.label} />
          ))}
        </Tabs>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_e, v) => v && setView(v)}
        >
          <ToggleButton value="cards" aria-label="Vue cartes">
            <LayoutGrid size={18} />
          </ToggleButton>
          <ToggleButton value="table" aria-label="Vue tableau">
            <ListIcon size={18} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <TextField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher par nom ou souche…"
        fullWidth
        sx={{ mb: 3 }}
        slotProps={{
          input: {
            startAdornment: (
              <Box sx={{ display: "flex", color: "text.secondary", mr: 1 }}>
                <Search size={18} />
              </Box>
            ),
          },
        }}
      />

      {/* Feature gate */}
      {featureLocked && (
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
            Activez le module pour gérer vos lots de poulets de chair.
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
      )}

      {!featureLocked && error && (
        <Alert severity="error">{apiErrorMessage(error)}</Alert>
      )}

      {!hasFarm && !farmLoading && (
        <Alert severity="info">
          Créez d&apos;abord une ferme pour gérer des lots.
        </Alert>
      )}

      {(isLoading || farmLoading) && hasFarm && !featureLocked && (
        <Box sx={GRID_SX}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={280} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
      )}

      {!isLoading && !error && batches && filtered.length === 0 && (
        <Box
          sx={{
            textAlign: "center",
            py: 8,
            border: (t) => `1px dashed ${t.palette.divider}`,
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Aucun lot
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Créez votre premier lot pour démarrer le suivi.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={() => setCreateOpen(true)}
            disabled={!hasFarm}
          >
            Nouveau lot
          </Button>
        </Box>
      )}

      {!isLoading && !error && filtered.length > 0 && farmId && (
        view === "cards" ? (
          <Box sx={GRID_SX}>
            {filtered.map((b) => (
              <PoultryBatchCard
                key={b.id}
                farmId={farmId}
                batch={b}
                breedName={breedNames[b.breedId]}
              />
            ))}
          </Box>
        ) : (
          <PoultryBatchesTable batches={filtered} breedNames={breedNames} />
        )
      )}

      {/* Mobile FAB — the FARMER's primary action on the go */}
      <Fab
        color="primary"
        aria-label="Nouveau lot"
        onClick={() => setCreateOpen(true)}
        disabled={!hasFarm || featureLocked}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          display: { xs: "flex", sm: "none" },
        }}
      >
        <Plus size={24} />
      </Fab>

      {farmId && (
        <CreateBatchDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          farmId={farmId}
        />
      )}
    </Box>
  );
}
