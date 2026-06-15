"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Copy, MoreVertical, Plus, RefreshCw } from "lucide-react";
import {
  useDeactivateFeedFormulaMutation,
  useGetAvailableFormulasQuery,
  useRecomputeFormulaCostMutation,
} from "@/store/api/feedFormulasApi";
import { useInventoryGating } from "@/hooks/useInventoryGating";
import { FeedFormulaDialog } from "@/components/inventory/FeedFormulaDialog";
import { FormulaCloneDialog } from "@/components/inventory/FormulaCloneDialog";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/format";
import { FEED_PHASE_LABELS } from "@/lib/inventory";
import { colors } from "@/theme/tokens";
import type { FeedFormula } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 700 } as const;

export default function FeedFormulasPage() {
  const { farmId, hasFarm, hasInventory } = useInventoryGating();
  const { showToast } = useToast();
  const { data, isLoading } = useGetAvailableFormulasQuery(
    { farmId: farmId as number },
    { skip: !hasFarm || !hasInventory },
  );
  const [recompute] = useRecomputeFormulaCostMutation();
  const [deactivate] = useDeactivateFeedFormulaMutation();

  const [formulaOpen, setFormulaOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [editing, setEditing] = useState<FeedFormula | null>(null);
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [menuFormula, setMenuFormula] = useState<FeedFormula | null>(null);

  if (hasFarm && !hasInventory) {
    return <Alert severity="info">Activez le module Inventaire pour gérer les formules.</Alert>;
  }

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMenuEl(null);
    try {
      await fn();
      showToast(ok, "success");
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const farmFormulas = data?.farmFormulas ?? [];

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Formules d&apos;aliment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Composez vos rations et optimisez vos coûts de production.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<Copy size={18} />} onClick={() => setCloneOpen(true)} disabled={!hasFarm}>
            Cloner un modèle
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={() => {
              setEditing(null);
              setFormulaOpen(true);
            }}
            disabled={!hasFarm}
          >
            Nouvelle formule
          </Button>
        </Stack>
      </Stack>

      {isLoading && <Skeleton variant="rectangular" height={240} sx={{ borderRadius: 3 }} />}

      {!isLoading && farmFormulas.length === 0 && (
        <Box sx={{ textAlign: "center", py: 8, border: (t) => `1px dashed ${t.palette.divider}`, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Aucune formule
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Créez une formule ou clonez un modèle plateforme pour démarrer.
          </Typography>
          <Button variant="contained" color="primary" startIcon={<Copy size={18} />} onClick={() => setCloneOpen(true)}>
            Cloner un modèle
          </Button>
        </Box>
      )}

      {!isLoading && farmFormulas.length > 0 && (
        <Box
          sx={{
            display: "grid",
            gap: { xs: 2, md: 3 },
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
          }}
        >
          {farmFormulas.map((f) => (
            <Card key={f.id}>
              <CardContent>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {f.name}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: "center" }}>
                      <Chip
                        label={FEED_PHASE_LABELS[f.targetPhase]}
                        size="small"
                        sx={{ bgcolor: colors.primary[50], color: colors.primary[700] }}
                      />
                      {f.sourceFormulaKey && (
                        <Typography variant="caption" color="text.secondary">
                          cloné
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                  <Stack sx={{ alignItems: "flex-end" }}>
                    <Typography sx={{ ...mono, color: colors.primary[600] }}>
                      {f.estimatedCostPer100kgXof != null
                        ? formatCurrency(f.estimatedCostPer100kgXof)
                        : "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      / 100 kg
                    </Typography>
                  </Stack>
                </Stack>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {f.ingredients.length} ingrédient{f.ingredients.length > 1 ? "s" : ""}
                    {f.totalPercentage != null ? ` · ${f.totalPercentage}%` : ""}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label="Actions"
                    onClick={(e) => {
                      setMenuEl(e.currentTarget);
                      setMenuFormula(f);
                    }}
                  >
                    <MoreVertical size={18} />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
        <MenuItem
          onClick={() => {
            if (menuFormula) {
              setEditing(menuFormula);
              setFormulaOpen(true);
            }
            setMenuEl(null);
          }}
        >
          Modifier
        </MenuItem>
        <MenuItem
          onClick={() =>
            menuFormula &&
            act(
              () => recompute({ farmId: farmId as number, id: menuFormula.id }).unwrap(),
              "Coût recalculé.",
            )
          }
        >
          <RefreshCw size={16} style={{ marginRight: 8 }} /> Recalculer le coût
        </MenuItem>
        <MenuItem
          onClick={() =>
            menuFormula &&
            act(
              () => deactivate({ farmId: farmId as number, id: menuFormula.id }).unwrap(),
              "Formule supprimée.",
            )
          }
          sx={{ color: colors.error.main }}
        >
          Supprimer
        </MenuItem>
      </Menu>

      {farmId && (
        <>
          <FeedFormulaDialog
            open={formulaOpen}
            onClose={() => setFormulaOpen(false)}
            farmId={farmId}
            formula={editing}
          />
          <FormulaCloneDialog open={cloneOpen} onClose={() => setCloneOpen(false)} farmId={farmId} />
        </>
      )}
    </Box>
  );
}
