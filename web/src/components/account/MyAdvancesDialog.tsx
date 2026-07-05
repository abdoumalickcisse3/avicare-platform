"use client";

import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import { useGetMyAdvancesQuery, useRequestAdvanceMutation } from "@/store/api/financeApi";
import { useSelectedFarm } from "@/hooks/useSelectedFarm";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { AdvanceStatus } from "@/types";

const STATUS_META: Record<AdvanceStatus, { label: string; bg: string; color: string }> = {
  PENDING: { label: "En attente", bg: colors.warning.light, color: colors.warning.dark },
  APPROVED: { label: "Approuvée", bg: colors.success.light, color: colors.success.dark },
  REJECTED: { label: "Refusée", bg: colors.error.light, color: colors.error.dark },
};

const schema = z.object({
  amountXof: z
    .string()
    .regex(/^\d+$/, "Montant entier requis")
    .refine((v) => Number(v) > 0, "Le montant doit être supérieur à 0"),
  reason: z.string().max(200, "200 caractères maximum").optional().or(z.literal("")),
});

type AdvanceForm = z.infer<typeof schema>;

const DEFAULTS: AdvanceForm = { amountXof: "", reason: "" };

interface Props {
  open: boolean;
  onClose: () => void;
}

export function MyAdvancesDialog({ open, onClose }: Props) {
  const { showToast } = useToast();
  const { farmId } = useSelectedFarm();
  const { data: advances, isLoading: loadingHistory } = useGetMyAdvancesQuery(
    { farmId: farmId as number },
    { skip: !open || farmId === undefined },
  );
  const [requestAdvance, { isLoading: submitting }] = useRequestAdvanceMutation();

  const { control, handleSubmit, reset } = useForm<AdvanceForm>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset(DEFAULTS);
    }
    wasOpen.current = open;
  }, [open, reset]);

  const onSubmit = async (values: AdvanceForm) => {
    if (farmId === undefined) return;
    try {
      await requestAdvance({
        body: {
          farmId,
          amountXof: Number(values.amountXof),
          reason: values.reason || undefined,
        },
      }).unwrap();
      showToast("Demande d'avance envoyée.", "success");
      reset(DEFAULTS);
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Mes avances
        </Typography>
        <IconButton onClick={onClose} aria-label="Fermer" sx={{ position: "absolute", top: 12, right: 12 }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="amountXof"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Montant (XOF)"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "numeric" } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Box>
            <Controller
              name="reason"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Motif (optionnel)"
                  fullWidth
                  multiline
                  minRows={2}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={submitting || farmId === undefined}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
              >
                Demander
              </Button>
            </Box>
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Historique
        </Typography>

        {loadingHistory && <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />}

        {!loadingHistory && advances && advances.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
            Aucune demande d&apos;avance.
          </Typography>
        )}

        {!loadingHistory && advances && advances.length > 0 && (
          <Stack spacing={1.5}>
            {advances.map((adv) => {
              const meta = STATUS_META[adv.status];
              return (
                <Box
                  key={adv.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    p: 1.5,
                    borderRadius: 2,
                    border: `1px solid ${colors.neutral[200]}`,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{formatCurrency(adv.amountXof)}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      Demandée le {formatDate(adv.requestedAt)}
                    </Typography>
                    {adv.status === "APPROVED" && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        Restant : {formatCurrency(adv.remainingXof)}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={meta.label}
                    size="small"
                    sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 600 }}
                  />
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Fermer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
