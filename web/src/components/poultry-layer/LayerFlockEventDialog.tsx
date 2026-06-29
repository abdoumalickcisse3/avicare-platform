"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import {
  useRecordMortalityMutation,
  useRecordUnitEventMutation,
} from "@/store/api/productionUnitsApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

type Mode = "mortality" | "reform";

const COPY: Record<Mode, { title: string; label: string; success: string }> = {
  mortality: {
    title: "Saisir une mortalité",
    label: "Nombre de sujets morts",
    success: "Mortalité enregistrée.",
  },
  reform: {
    title: "Réforme de la bande",
    label: "Nombre de sujets réformés",
    success: "Réforme enregistrée.",
  },
};

export function LayerFlockEventDialog({
  open,
  onClose,
  farmId,
  unitId,
  mode,
  currentCount,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  unitId: number;
  mode: Mode;
  currentCount: number;
}) {
  const { showToast } = useToast();
  const [recordMortality, { isLoading: mLoading }] = useRecordMortalityMutation();
  const [recordUnitEvent, { isLoading: eLoading }] = useRecordUnitEventMutation();
  const [count, setCount] = useState(0);
  const [reason, setReason] = useState("");

  const copy = COPY[mode];
  const saving = mLoading || eLoading;
  const overCount = count > currentCount;

  const reset = () => {
    setCount(0);
    setReason("");
  };

  const submit = async () => {
    if (count <= 0) return;
    try {
      if (mode === "mortality") {
        await recordMortality({
          farmId,
          unitId,
          body: { count, reason: reason || undefined },
        }).unwrap();
      } else {
        await recordUnitEvent({
          farmId,
          unitId,
          body: { eventType: "REFORM", quantityDelta: -count, reason: reason || undefined },
        }).unwrap();
      }
      showToast(copy.success, "success");
      reset();
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>{copy.title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label={`Nombre — ${copy.label}`}
            type="number"
            value={count === 0 ? "" : count}
            onChange={(e) =>
              setCount(Math.max(0, Math.floor(Number(e.target.value) || 0)))
            }
            inputMode="numeric"
            autoFocus
            fullWidth
          />
          <TextField
            label="Motif (optionnel)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
          />
          {overCount && (
            <Alert severity="warning">
              Dépasse l&apos;effectif actuel ({currentCount}) — le serveur refusera si l&apos;effectif
              passe sous 0.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={() => {
            reset();
            onClose();
          }}
          color="inherit"
        >
          Annuler
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          disabled={count <= 0 || saving}
        >
          Enregistrer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
