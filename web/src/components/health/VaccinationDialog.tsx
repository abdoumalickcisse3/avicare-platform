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
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { ChevronDown, ChevronUp, Syringe, X } from "lucide-react";
import {
  useGetVaccinesQuery,
  useRecordVaccinationMutation,
} from "@/store/api/healthApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { useInventoryGating } from "@/hooks/useInventoryGating";
import { StockConsumptionSection } from "@/components/inventory/StockConsumptionSection";
import { apiErrorMessage } from "@/lib/apiError";
import { humanizeKey } from "@/lib/health";
import { colors } from "@/theme/tokens";
import { SectionLabel, today } from "./HealthDialogParts";
import type { StockConsumption, Vaccine } from "@/types";

const schema = z.object({
  vaccineKey: z.string().min(1, "Vaccin requis"),
  administeredDate: z.string().min(1, "Date requise"),
  route: z.string().optional().or(z.literal("")),
  dosePerSubject: z.string().regex(/^\d*\.?\d*$/, "Nombre requis").optional().or(z.literal("")),
  doseUnit: z.string().optional().or(z.literal("")),
  subjectsCount: z.string().regex(/^\d+$/, "Nombre entier requis"),
  vaccineBatchNumber: z.string().max(80).optional().or(z.literal("")),
  vaccineExpiryDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000, "2000 caractères maximum").optional().or(z.literal("")),
});

type VaccinationForm = z.infer<typeof schema>;

/** Prefill when opened from a calendar card (programmed dose). */
export interface VaccinationPrefill {
  vaccineKey?: string;
  route?: string;
  administeredDate?: string;
}

export function VaccinationDialog({
  open,
  onClose,
  farmId,
  unitId,
  unitName,
  currentCount,
  currentUserId,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  unitId: number;
  unitName: string;
  currentCount: number;
  currentUserId?: number;
  prefill?: VaccinationPrefill;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { showToast } = useToast();
  const { data: vaccines = [] } = useGetVaccinesQuery({ farmId }, { skip: !open });
  const { hasInventory } = useInventoryGating();
  const [recordVaccination, { isLoading }] = useRecordVaccinationMutation();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [consumption, setConsumption] = useState<StockConsumption | null>(null);

  const defaults = useMemo<VaccinationForm>(
    () => ({
      vaccineKey: prefill?.vaccineKey ?? "",
      administeredDate: prefill?.administeredDate ?? today(),
      route: prefill?.route ?? "",
      dosePerSubject: "",
      doseUnit: "",
      subjectsCount: currentCount > 0 ? String(currentCount) : "",
      vaccineBatchNumber: "",
      vaccineExpiryDate: "",
      notes: "",
    }),
    [prefill, currentCount],
  );

  const { control, handleSubmit, reset, setValue } = useForm<VaccinationForm>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, reset, defaults]);

  const handleClose = () => {
    setAdvancedOpen(false);
    onClose();
  };

  const selectedKey = useWatch({ control, name: "vaccineKey" });
  const selected = useMemo<Vaccine | undefined>(
    () => vaccines.find((v) => v.key === selectedKey),
    [vaccines, selectedKey],
  );

  const onSubmit = async (values: VaccinationForm) => {
    try {
      await recordVaccination({
        farmId,
        body: {
          unitId,
          vaccineKey: values.vaccineKey,
          administeredDate: values.administeredDate,
          route: values.route || undefined,
          dosePerSubject: values.dosePerSubject ? Number(values.dosePerSubject) : undefined,
          doseUnit: values.doseUnit || undefined,
          subjectsCount: Number(values.subjectsCount),
          vaccineBatchNumber: values.vaccineBatchNumber || undefined,
          vaccineExpiryDate: values.vaccineExpiryDate || undefined,
          administeredByUserId: currentUserId,
          notes: values.notes || undefined,
          stockConsumption: consumption ?? undefined,
        },
      }).unwrap();
      showToast("Vaccination enregistrée.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DialogTitle component="div" sx={{ pr: 6 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Nouvelle vaccination
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {unitName}
          </Typography>
          <IconButton
            onClick={handleClose}
            aria-label="Fermer"
            sx={{ position: "absolute", top: 12, right: 12 }}
          >
            <X size={20} />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <SectionLabel color={colors.primary[500]}>Vaccin</SectionLabel>
            <Controller
              name="vaccineKey"
              control={control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={vaccines}
                  getOptionLabel={(o) => o.label}
                  value={vaccines.find((v) => v.key === field.value) ?? null}
                  onChange={(_, opt) => {
                    field.onChange(opt?.key ?? "");
                    if (opt?.route) setValue("route", opt.route);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Vaccin"
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
              <Alert
                icon={<Syringe size={18} />}
                severity="info"
                sx={{ py: 0.5, alignItems: "center" }}
              >
                Cible&nbsp;: <strong>{humanizeKey(selected.disease)}</strong>
                {selected.route ? ` · Voie recommandée : ${selected.route}` : ""}
              </Alert>
            )}

            <SectionLabel color={colors.primary[500]}>Administration</SectionLabel>
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="administeredDate"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="Date d'administration"
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
                name="route"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Voie" placeholder="ex. eau de boisson" fullWidth />
                )}
              />
            </Box>

            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
              <Controller
                name="subjectsCount"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    type="number"
                    label="Sujets vaccinés"
                    fullWidth
                    required
                    slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? `Effectif actuel : ${currentCount}`}
                  />
                )}
              />
              <Controller
                name="dosePerSubject"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Dose / sujet"
                    placeholder="ex. 0.5"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "decimal" } }}
                  />
                )}
              />
              <Controller
                name="doseUnit"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Unité" placeholder="ml" fullWidth />
                )}
              />
            </Box>

            <Link
              component="button"
              type="button"
              underline="none"
              onClick={() => setAdvancedOpen((v) => !v)}
              sx={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 0.5 }}
            >
              {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Avancé (lot, péremption, notes)
            </Link>
            <Collapse in={advancedOpen} unmountOnExit>
              <Stack spacing={2}>
                <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
                  <Controller
                    name="vaccineBatchNumber"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} label="N° de lot vaccin" fullWidth />
                    )}
                  />
                  <Controller
                    name="vaccineExpiryDate"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        type="date"
                        label="Date de péremption"
                        fullWidth
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    )}
                  />
                </Box>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Notes"
                      fullWidth
                      multiline
                      minRows={2}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Stack>
            </Collapse>

            {hasInventory && (
              <StockConsumptionSection
                farmId={farmId}
                open={open}
                onChange={setConsumption}
                label="Décrémenter le vaccin du stock"
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
            startIcon={<Syringe size={18} />}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
