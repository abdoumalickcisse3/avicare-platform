"use client";

import { useState } from "react";
import {
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
import { useGetPlatformFormulasQuery } from "@/store/api/inventoryCatalogApi";
import { useToast } from "@/components/feedback/ToastProvider";
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
