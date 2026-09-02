"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Lock, X } from "lucide-react";
import { useCloseUnitMutation } from "@/store/api/closureApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";

const schema = z.object({
  chickCostXof: z
    .string()
    .regex(/^\d*$/, "Nombre entier requis")
    .optional()
    .or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

type CloseForm = z.infer<typeof schema>;

const DEFAULTS: CloseForm = { chickCostXof: "", notes: "" };

/**
 * Closing a batch. The chick cost is asked here because it is recorded nowhere else in the
 * platform, and it is the second-largest cost of a broiler cycle — the report would understate
 * the true cost without it.
 */
export function CloseBatchDialog({
  open,
  onClose,
  farmId,
  unitId,
  batchName,
  remainingCount,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  unitId: number;
  batchName: string;
  remainingCount: number;
}) {
  const [closeUnit, { isLoading }] = useCloseUnitMutation();
  const { showToast } = useToast();

  const { control, handleSubmit, reset } = useForm<CloseForm>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  // Edge-triggered on `open`, never on every render.
  useEffect(() => {
    if (open) reset(DEFAULTS);
  }, [open, reset]);

  const onSubmit = async (values: CloseForm) => {
    try {
      await closeUnit({
        farmId,
        unitId,
        body: {
          chickCostXof: values.chickCostXof ? Number(values.chickCostXof) : undefined,
          notes: values.notes || undefined,
        },
      }).unwrap();
      showToast("Bande clôturée. Le bilan est figé.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle component="div" sx={{ pr: 6 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Box sx={{ color: colors.neutral[500], display: "flex" }}>
              <Lock size={20} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Clôturer la bande
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {batchName}
              </Typography>
            </Box>
          </Stack>
          <IconButton
            aria-label="Fermer"
            onClick={onClose}
            sx={{ position: "absolute", right: 12, top: 12 }}
          >
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Alert severity="info">
              Le bilan sera <strong>figé</strong> au moment de la clôture. Une dépense saisie
              plus tard ne le modifiera plus. Vous pourrez rouvrir la bande, ce qui supprimera
              le bilan.
            </Alert>

            {remainingCount > 0 && (
              <Alert severity="warning">
                Il reste {remainingCount} sujets sur cette bande. Ils seront comptés comme
                produits dans le bilan.
              </Alert>
            )}

            <Controller
              name="chickCostXof"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Coût des poussins"
                  placeholder="Optionnel"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    "Non enregistré ailleurs dans l'application. Sans lui, le coût est sous-estimé."
                  }
                  slotProps={{
                    input: {
                      endAdornment: <InputAdornment position="end">F CFA</InputAdornment>,
                    },
                  }}
                />
              )}
            />

            <Controller
              name="notes"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Note"
                  placeholder="Optionnel"
                  fullWidth
                  multiline
                  minRows={2}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} color="inherit">
            Annuler
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Clôturer
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
