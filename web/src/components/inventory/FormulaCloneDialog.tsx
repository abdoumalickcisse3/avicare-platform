"use client";

import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import { useCloneFeedFormulaMutation } from "@/store/api/feedFormulasApi";
import {
  useGetPlatformFormulaQuery,
  useGetPlatformFormulasQuery,
} from "@/store/api/inventoryCatalogApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { FEED_PHASE_LABELS } from "@/lib/inventory";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { apiErrorMessage } from "@/lib/apiError";

export function FormulaCloneDialog({
  open,
  onClose,
  farmId,
  presetKey,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  presetKey?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      {open && <FormulaCloneBody onClose={onClose} farmId={farmId} presetKey={presetKey} />}
    </Dialog>
  );
}

function FormulaCloneBody({
  onClose,
  farmId,
  presetKey,
}: {
  onClose: () => void;
  farmId: number;
  presetKey?: string;
}) {
  const { showToast } = useToast();
  const { data: templates = [] } = useGetPlatformFormulasQuery({ farmId });
  const [clone, { isLoading }] = useCloneFeedFormulaMutation();

  const [sourceKey, setSourceKey] = useState(presetKey ?? "");
  // What the farmer is about to adopt: the composition and a cost recomputed from today's catalog
  // prices. Choosing a ration by its name alone is choosing what the birds eat, and what it costs,
  // without seeing either.
  const { data: preview, isFetching: loadingPreview } = useGetPlatformFormulaQuery(
    { farmId, key: sourceKey },
    { skip: sourceKey === "" },
  );
  const [newName, setNewName] = useState("");

  const submit = async () => {
    try {
      await clone({
        farmId,
        body: { sourceFormulaKey: sourceKey, newName: newName || undefined },
      }).unwrap();
      showToast("Formule clonée.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <>
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Cloner une formule
        </Typography>
        <IconButton onClick={onClose} aria-label="Fermer" sx={{ position: "absolute", top: 12, right: 12 }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Partez d&apos;un modèle plateforme et personnalisez-le pour votre ferme.
          </Typography>
          <TextField
            select
            label="Modèle source"
            value={sourceKey}
            onChange={(e) => setSourceKey(e.target.value)}
            fullWidth
            required
          >
            {templates.map((t) => (
              <MenuItem key={t.key} value={t.key}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          {sourceKey !== "" && (
            <Box
              sx={{
                border: `1px solid ${colors.neutral[200]}`,
                borderRadius: 1,
                p: 2,
                bgcolor: colors.neutral[50],
              }}
            >
              {loadingPreview && !preview ? (
                <Typography variant="body2" color="text.secondary">
                  Lecture de la composition…
                </Typography>
              ) : preview ? (
                <Stack spacing={1.25}>
                  <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
                    <Typography variant="subtitle2">Composition</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {FEED_PHASE_LABELS[preview.targetPhase as keyof typeof FEED_PHASE_LABELS] ??
                        preview.targetPhase}
                      {preview.targetAgeDaysMin != null || preview.targetAgeDaysMax != null
                        ? ` · ${preview.targetAgeDaysMin ?? 0}–${preview.targetAgeDaysMax ?? "…"} j`
                        : ""}
                    </Typography>
                  </Stack>
                  {preview.ingredients.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Ce modèle ne liste aucun ingrédient.
                    </Typography>
                  ) : (
                    preview.ingredients.map((i) => (
                      <Stack
                        key={`${i.articleSource}:${i.articleKey}`}
                        direction="row"
                        sx={{ justifyContent: "space-between", gap: 2 }}
                      >
                        <Typography variant="body2">{i.articleKey}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {i.percentage} %
                        </Typography>
                      </Stack>
                    ))
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {preview.estimatedCostPer100kgXof == null
                      ? "Coût non calculable : un ingrédient n'a pas de prix au catalogue."
                      : `Environ ${formatCurrency(preview.estimatedCostPer100kgXof)} les 100 kg, aux prix du catalogue d'aujourd'hui.`}
                  </Typography>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Composition indisponible — le clonage reste possible.
                </Typography>
              )}
            </Box>
          )}
          <TextField
            label="Nouveau nom (optionnel)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Annuler
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={!sourceKey || isLoading}
          onClick={submit}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Cloner
        </Button>
      </DialogActions>
    </>
  );
}
