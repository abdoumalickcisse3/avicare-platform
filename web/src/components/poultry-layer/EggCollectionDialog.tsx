"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { Egg, X } from "lucide-react";
import { useRecordCollectionMutation } from "@/store/api/eggProductionApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import {
  defaultTimeslotForNow,
  remainingToDistribute,
  sortGradeKeys,
  timeslotLabel,
} from "@/lib/layer";
import { colors } from "@/theme/tokens";

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  collectionDate: z.string().min(1, "Date requise"),
  timeslotKey: z.string().min(1, "Créneau requis"),
  totalEggs: z.string().regex(/^\d+$/, "Nombre entier requis"),
  brokenEggs: z
    .string()
    .regex(/^\d*$/, "Nombre entier requis")
    .optional()
    .or(z.literal("")),
  grades: z.record(z.string(), z.string()),
  notes: z.string().max(2000, "2000 caractères maximum").optional().or(z.literal("")),
});

type CollectionForm = z.infer<typeof schema>;

function SectionLabel({ color, children }: { color: string; children: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Box sx={{ width: 4, height: 16, borderRadius: 1, bgcolor: color }} />
      <Typography sx={{ fontWeight: 600 }}>{children}</Typography>
    </Stack>
  );
}

export function EggCollectionDialog({
  open,
  onClose,
  farmId,
  unitId,
  unitName,
  timeslots,
  grades,
  existingKeys,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  unitId: number;
  unitName: string;
  /** Configured time-slot keys for the farm. */
  timeslots: string[];
  /** Configured egg-grade keys for the farm. */
  grades: string[];
  /** "date|timeslot" pairs already recorded for the unit (upsert warning). */
  existingKeys: string[];
}) {
  const { showToast } = useToast();
  const [recordCollection, { isLoading }] = useRecordCollectionMutation();

  const sortedGrades = useMemo(() => sortGradeKeys(grades), [grades]);

  const defaults = useMemo<CollectionForm>(
    () => ({
      collectionDate: today(),
      timeslotKey: defaultTimeslotForNow(timeslots),
      totalEggs: "",
      brokenEggs: "",
      grades: Object.fromEntries(sortedGrades.map((g) => [g, ""])),
      notes: "",
    }),
    [timeslots, sortedGrades],
  );

  const { control, handleSubmit, reset } = useForm<CollectionForm>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, reset, defaults]);

  const keySet = useMemo(() => new Set(existingKeys), [existingKeys]);
  const watchedDate = useWatch({ control, name: "collectionDate" });
  const watchedSlot = useWatch({ control, name: "timeslotKey" });
  const watchedTotal = useWatch({ control, name: "totalEggs" });
  const watchedGrades = useWatch({ control, name: "grades" });
  const isUpdate =
    !!watchedDate && !!watchedSlot && keySet.has(`${watchedDate}|${watchedSlot}`);

  const numericGrades = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(watchedGrades ?? {})) {
      const n = Number(v);
      if (v !== "" && Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  }, [watchedGrades]);
  const totalNum = Number(watchedTotal);
  const remaining = remainingToDistribute(
    Number.isFinite(totalNum) ? totalNum : 0,
    numericGrades,
  );

  const onSubmit = async (values: CollectionForm) => {
    try {
      await recordCollection({
        farmId,
        body: {
          unitId,
          collectionDate: values.collectionDate,
          timeslotKey: values.timeslotKey,
          totalEggs: Number(values.totalEggs),
          brokenEggs: values.brokenEggs ? Number(values.brokenEggs) : 0,
          gradesCount: Object.keys(numericGrades).length ? numericGrades : undefined,
          notes: values.notes || undefined,
        },
      }).unwrap();
      showToast(
        isUpdate ? "Collecte mise à jour." : "Collecte enregistrée avec succès.",
        "success",
      );
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle component="div" sx={{ pr: 6 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Saisir une collecte d&apos;œufs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {unitName}
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="Fermer"
            sx={{ position: "absolute", top: 12, right: 12 }}
          >
            <X size={20} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <SectionLabel color={colors.primary[500]}>Informations générales</SectionLabel>
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="collectionDate"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="Date"
                    fullWidth
                    slotProps={{
                      inputLabel: { shrink: true },
                      htmlInput: { max: today() },
                    }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="timeslotKey"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    select
                    label="Créneau"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  >
                    {timeslots.map((s) => (
                      <MenuItem key={s} value={s}>
                        {timeslotLabel(s)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Box>

            {isUpdate && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Une collecte existe déjà pour ce créneau — elle sera mise à jour.
              </Alert>
            )}

            <SectionLabel color={colors.primary[500]}>Saisie</SectionLabel>
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="totalEggs"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Total d'œufs"
                    placeholder="0"
                    fullWidth
                    required
                    autoFocus
                    slotProps={{
                      htmlInput: { inputMode: "numeric", min: 0 },
                      input: {
                        startAdornment: (
                          <Box sx={{ display: "flex", color: colors.primary[500], mr: 1 }}>
                            <Egg size={18} />
                          </Box>
                        ),
                      },
                    }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="brokenEggs"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Œufs cassés"
                    placeholder="0"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message ??
                      "Comptés séparément, non inclus dans le total."
                    }
                  />
                )}
              />
            </Box>

            {sortedGrades.length > 0 && (
              <>
                <Stack
                  direction="row"
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <SectionLabel color={colors.accent[400]}>
                    Répartition par calibre
                  </SectionLabel>
                  <Chip
                    size="small"
                    label={`Reste à répartir : ${remaining}`}
                    sx={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      bgcolor: remaining === 0 ? colors.success.light : colors.accent[50],
                      color: remaining === 0 ? colors.success.dark : colors.accent[700],
                    }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Optionnel — la somme des calibres n&apos;a pas à égaler le total.
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
                  }}
                >
                  {sortedGrades.map((g) => (
                    <Controller
                      key={g}
                      name={`grades.${g}`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          value={field.value ?? ""}
                          type="number"
                          label={`Calibre ${g}`}
                          slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                        />
                      )}
                    />
                  ))}
                </Box>
              </>
            )}

            <SectionLabel color={colors.primary[500]}>Notes</SectionLabel>
            <Controller
              name="notes"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Observations"
                  placeholder="Conditions, incidents, collecteur…"
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
            {isUpdate ? "Mettre à jour" : "Enregistrer"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
