"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Info, Pill, X } from "lucide-react";
import {
  useGetTreatmentCatalogQuery,
  useGetVeterinariansQuery,
  useRecordTreatmentMutation,
} from "@/store/api/healthApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { useInventoryGating } from "@/hooks/useInventoryGating";
import { StockConsumptionSection } from "@/components/inventory/StockConsumptionSection";
import { apiErrorMessage } from "@/lib/apiError";
import { humanizeKey, projectWithdrawal } from "@/lib/health";
import { colors } from "@/theme/tokens";
import { SectionLabel, today } from "./HealthDialogParts";
import { WithdrawalNotice } from "./WithdrawalNotice";
import type { StockConsumption, Treatment } from "@/types";

const PRESCRIBED_BY = [
  { value: "VETERINARIAN", label: "Vétérinaire" },
  { value: "FARMER", label: "Éleveur" },
  { value: "AUTO", label: "Auto-prescription" },
];

const schema = z.object({
  treatmentKey: z.string().min(1, "Traitement requis"),
  startDate: z.string().min(1, "Date requise"),
  durationDays: z.string().regex(/^\d+$/, "Nombre de jours requis"),
  doseAmount: z.string().regex(/^\d*\.?\d+$/, "Dose requise"),
  doseUnit: z.string().min(1, "Unité requise"),
  route: z.string().min(1, "Voie requise"),
  subjectsCount: z.string().regex(/^\d+$/, "Nombre entier requis"),
  reason: z.string().optional().or(z.literal("")),
  prescribedBy: z.string().optional().or(z.literal("")),
  veterinarianId: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

type TreatmentForm = z.infer<typeof schema>;

export function TreatmentDialog({
  open,
  onClose,
  farmId,
  unitId,
  unitName,
  currentCount,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  unitId: number;
  unitName: string;
  currentCount: number;
  currentUserId?: number;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { showToast } = useToast();
  const { data: catalog = [] } = useGetTreatmentCatalogQuery({ farmId }, { skip: !open });
  const { data: vets = [] } = useGetVeterinariansQuery({ farmId }, { skip: !open });
  const { hasInventory } = useInventoryGating();
  const [recordTreatment, { isLoading }] = useRecordTreatmentMutation();
  const [consumption, setConsumption] = useState<StockConsumption | null>(null);

  const defaults = useMemo<TreatmentForm>(
    () => ({
      treatmentKey: "",
      startDate: today(),
      durationDays: "3",
      doseAmount: "",
      doseUnit: "",
      route: "",
      subjectsCount: currentCount > 0 ? String(currentCount) : "",
      reason: "",
      prescribedBy: "FARMER",
      veterinarianId: "",
      notes: "",
    }),
    [currentCount],
  );

  const { control, handleSubmit, reset, setValue } = useForm<TreatmentForm>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, reset, defaults]);

  const selectedKey = useWatch({ control, name: "treatmentKey" });
  const startDate = useWatch({ control, name: "startDate" });
  const durationDays = useWatch({ control, name: "durationDays" });
  const prescribedBy = useWatch({ control, name: "prescribedBy" });

  const selected = useMemo<Treatment | undefined>(
    () => catalog.find((t) => t.key === selectedKey),
    [catalog, selectedKey],
  );

  const projected = useMemo(() => {
    if (!startDate || !/^\d+$/.test(durationDays)) return null;
    return projectWithdrawal(
      startDate,
      Number(durationDays),
      selected?.withdrawalDaysMeat ?? null,
      selected?.withdrawalDaysEggs ?? null,
    );
  }, [startDate, durationDays, selected]);

  const onSubmit = async (values: TreatmentForm) => {
    try {
      await recordTreatment({
        farmId,
        body: {
          unitId,
          treatmentKey: values.treatmentKey,
          startDate: values.startDate,
          durationDays: Number(values.durationDays),
          doseAmount: Number(values.doseAmount),
          doseUnit: values.doseUnit,
          route: values.route,
          subjectsCount: Number(values.subjectsCount),
          reason: values.reason || undefined,
          prescribedBy: values.prescribedBy || undefined,
          veterinarianId:
            values.prescribedBy === "VETERINARIAN" && values.veterinarianId
              ? Number(values.veterinarianId)
              : undefined,
          notes: values.notes || undefined,
          administeredByUserId: currentUserId,
          stockConsumption: consumption ?? undefined,
        },
      }).unwrap();
      showToast("Traitement enregistré.", "success");
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
            Nouveau traitement
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
            <SectionLabel color={colors.info.main}>Médicament</SectionLabel>
            <Controller
              name="treatmentKey"
              control={control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={catalog}
                  getOptionLabel={(o) => o.label}
                  value={catalog.find((t) => t.key === field.value) ?? null}
                  onChange={(_, opt) => {
                    field.onChange(opt?.key ?? "");
                    if (opt?.routes?.length) setValue("route", opt.routes[0]);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Molécule / médicament"
                      required
                      autoFocus
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />
            {selected && (
              <Alert icon={<Info size={18} />} severity="info" sx={{ py: 0.5 }}>
                {humanizeKey(selected.molecule)}
                {selected.drugClass ? ` · ${humanizeKey(selected.drugClass)}` : ""} · Délai légal&nbsp;:{" "}
                <strong>
                  {selected.withdrawalDaysEggs ?? "?"} j œufs / {selected.withdrawalDaysMeat ?? "?"} j viande
                </strong>
              </Alert>
            )}

            <SectionLabel color={colors.info.main}>Posologie</SectionLabel>
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="startDate"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="Date de début"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="durationDays"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Durée (jours)"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "numeric", min: 1 } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="doseAmount"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Dose"
                    placeholder="ex. 200"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "decimal" } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="doseUnit"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Unité"
                    placeholder="g/1000L"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="route"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    select={!!selected?.routes?.length}
                    label="Voie d'administration"
                    placeholder="eau de boisson"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  >
                    {(selected?.routes ?? []).map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <Controller
                name="subjectsCount"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Sujets traités"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? `Effectif : ${currentCount}`}
                  />
                )}
              />
            </Box>

            {projected && (
              <WithdrawalNotice
                withdrawalDaysMeat={selected?.withdrawalDaysMeat ?? null}
                withdrawalDaysEggs={selected?.withdrawalDaysEggs ?? null}
                withdrawalEndDateMeat={projected.withdrawalEndDateMeat}
                withdrawalEndDateEggs={projected.withdrawalEndDateEggs}
              />
            )}

            <SectionLabel color={colors.info.main}>Prescription</SectionLabel>
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="prescribedBy"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Prescrit par" fullWidth>
                    {PRESCRIBED_BY.map((p) => (
                      <MenuItem key={p.value} value={p.value}>
                        {p.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              {prescribedBy === "VETERINARIAN" && (
                <Controller
                  name="veterinarianId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Vétérinaire"
                      fullWidth
                      helperText={vets.length === 0 ? "Aucun vétérinaire enregistré" : undefined}
                    >
                      {vets.map((v) => (
                        <MenuItem key={v.id} value={String(v.id)}>
                          {v.fullName}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              )}
            </Box>
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Motif du traitement"
                  placeholder="ex. coccidiose, prophylaxie…"
                  fullWidth
                  multiline
                  minRows={2}
                />
              )}
            />

            {hasInventory && (
              <StockConsumptionSection
                farmId={farmId}
                open={open}
                onChange={setConsumption}
                sourceFilter="TREATMENT"
                label="Décrémenter le médicament du stock"
              />
            )}
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
            startIcon={<Pill size={18} />}
          >
            Enregistrer le traitement
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
