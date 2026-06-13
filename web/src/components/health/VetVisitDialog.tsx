"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Alert,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Stethoscope, X } from "lucide-react";
import {
  useGetVeterinariansQuery,
  useRecordVetVisitMutation,
} from "@/store/api/healthApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";
import { SectionLabel, today } from "./HealthDialogParts";

const schema = z
  .object({
    veterinarianId: z.string().optional().or(z.literal("")),
    visitDate: z.string().min(1, "Date requise"),
    reason: z.string().min(1, "Motif requis"),
    diagnosis: z.string().optional().or(z.literal("")),
    recommendations: z.string().optional().or(z.literal("")),
    costXof: z.string().regex(/^\d*$/, "Montant entier").optional().or(z.literal("")),
    followUpNeeded: z.boolean(),
    followUpDate: z.string().optional().or(z.literal("")),
  })
  .refine((v) => !v.followUpNeeded || !!v.followUpDate, {
    message: "Date de suivi requise",
    path: ["followUpDate"],
  });

type VetVisitForm = z.infer<typeof schema>;

export function VetVisitDialog({
  open,
  onClose,
  farmId,
  unitId,
  unitName,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  unitId: number;
  unitName: string;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { showToast } = useToast();
  const { data: vets = [] } = useGetVeterinariansQuery({ farmId }, { skip: !open });
  const [recordVisit, { isLoading }] = useRecordVetVisitMutation();

  const defaults = useMemo<VetVisitForm>(
    () => ({
      veterinarianId: "",
      visitDate: today(),
      reason: "",
      diagnosis: "",
      recommendations: "",
      costXof: "",
      followUpNeeded: false,
      followUpDate: "",
    }),
    [],
  );

  const { control, handleSubmit, reset } = useForm<VetVisitForm>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, reset, defaults]);

  const followUpNeeded = useWatch({ control, name: "followUpNeeded" });
  const veterinarianId = useWatch({ control, name: "veterinarianId" });

  const onSubmit = async (values: VetVisitForm) => {
    try {
      await recordVisit({
        farmId,
        body: {
          unitId,
          veterinarianId: values.veterinarianId ? Number(values.veterinarianId) : undefined,
          visitDate: values.visitDate,
          reason: values.reason,
          diagnosis: values.diagnosis || undefined,
          recommendations: values.recommendations || undefined,
          costXof: values.costXof ? Number(values.costXof) : undefined,
          followUpNeeded: values.followUpNeeded,
          followUpDate: values.followUpNeeded ? values.followUpDate || undefined : undefined,
        },
      }).unwrap();
      showToast("Visite enregistrée.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle component="div" sx={{ pr: 6 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Nouvelle visite vétérinaire
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
            <SectionLabel color={colors.vet.main}>Visite</SectionLabel>
            <Controller
              name="veterinarianId"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Vétérinaire" fullWidth>
                  <MenuItem value="">Visite anonyme</MenuItem>
                  {vets.map((v) => (
                    <MenuItem key={v.id} value={String(v.id)}>
                      {v.fullName}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            {!veterinarianId && vets.length === 0 && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                Pensez à créer votre annuaire de vétérinaires pour un meilleur suivi.
              </Alert>
            )}

            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="visitDate"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="Date de visite"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="costXof"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Coût (XOF)"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
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
                  label="Motif"
                  placeholder="ex. contrôle trimestriel, mortalité élevée…"
                  fullWidth
                  required
                  multiline
                  minRows={2}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />

            <SectionLabel color={colors.vet.main}>Compte rendu (optionnel)</SectionLabel>
            <Controller
              name="diagnosis"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Diagnostic" fullWidth multiline minRows={2} />
              )}
            />
            <Controller
              name="recommendations"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Recommandations" fullWidth multiline minRows={2} />
              )}
            />

            <Controller
              name="followUpNeeded"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                  }
                  label="Suivi requis"
                />
              )}
            />
            <Collapse in={followUpNeeded} unmountOnExit>
              <Controller
                name="followUpDate"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="Date de suivi"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today() } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Collapse>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, position: "sticky", bottom: 0, bgcolor: "background.paper" }}>
          <Button onClick={onClose} color="inherit">
            Annuler
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            disabled={isLoading}
            startIcon={<Stethoscope size={18} />}
          >
            Enregistrer la visite
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
