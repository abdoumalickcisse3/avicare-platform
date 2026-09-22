"use client";

import { useEffect, useRef } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Plus, Trash2 } from "lucide-react";
import type { Breed, Vaccine, VaccinationProgram } from "@/types";
import { useCreateProgramMutation, useUpdateProgramMutation } from "@/store/api/healthApi";
import { useGetBreedsQuery } from "@/store/api/breedsApi";
import { HEALTH_ROUTE_LABELS } from "@/lib/health";
import { slugify } from "@/lib/slug";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";

const scheduleEntrySchema = z.object({
  vaccineKey: z.string().min(1, "Requis"),
  ageValue: z.string().regex(/^\d+$/, "Entier"),
  ageUnit: z.enum(["DAY", "WEEK"]),
  route: z.string().optional(),
  mandatory: z.boolean(),
});
const schema = z.object({
  label: z.string().min(1, "Ce champ est requis"),
  breedKeys: z.array(z.string()).min(1, "Au moins une race"),
  schedule: z.array(scheduleEntrySchema).min(1, "Au moins une étape"),
});
type FormValues = z.infer<typeof schema>;

const emptyEntry = (): FormValues["schedule"][number] => ({
  vaccineKey: "",
  ageValue: "",
  ageUnit: "DAY",
  route: "",
  mandatory: false,
});

function toFormValues(program?: VaccinationProgram): FormValues {
  return {
    label: program?.label ?? "",
    breedKeys: program?.breedKeys ?? [],
    schedule: program?.schedule.length
      ? program.schedule.map((s) => ({
          vaccineKey: s.vaccineKey,
          ageValue: String(s.ageValue),
          ageUnit: s.ageUnit === "WEEK" ? "WEEK" : "DAY",
          route: s.route ?? "",
          mandatory: s.mandatory,
        }))
      : [emptyEntry()],
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  farmId: number;
  /** When set, edits this custom program (key is fixed). */
  program?: VaccinationProgram;
  /** When set (and `program` is not), pre-fills the form from a platform program to clone. */
  cloneFrom?: VaccinationProgram;
  /** All farm-visible program keys — used to reject duplicate creates. */
  existingKeys?: string[];
  vaccines: Vaccine[];
}

export function ProgramDialog({
  open,
  onClose,
  farmId,
  program,
  cloneFrom,
  existingKeys = [],
  vaccines,
}: Props) {
  const { showToast } = useToast();
  const { data: breeds = [] } = useGetBreedsQuery();
  const [createProgram, { isLoading: creating }] = useCreateProgramMutation();
  const [updateProgram, { isLoading: updating }] = useUpdateProgramMutation();
  const isEdit = program != null;
  const source = program ?? cloneFrom;

  const { control, handleSubmit, reset, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "schedule" });

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset(toFormValues(source));
    }
    wasOpen.current = open;
  }, [open, source, reset]);

  const onSubmit = async (values: FormValues) => {
    const value: Record<string, unknown> = {
      label: values.label,
      species: "POULTRY",
      breed_keys: values.breedKeys,
      schedule: values.schedule.map((s) => ({
        age: { value: Number(s.ageValue), unit: s.ageUnit },
        vaccine_key: s.vaccineKey,
        ...(s.route ? { route: s.route } : {}),
        mandatory: s.mandatory,
      })),
    };
    const key = isEdit ? program!.key : slugify(values.label);
    if (!isEdit && existingKeys.includes(key)) {
      setError("label", { message: "Un programme avec ce nom existe déjà" });
      return;
    }
    try {
      if (isEdit) await updateProgram({ farmId, key, value }).unwrap();
      else await createProgram({ farmId, key, value }).unwrap();
      showToast(isEdit ? "Programme modifié" : "Programme créé", "success");
      onClose();
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {isEdit ? "Modifier le programme" : cloneFrom ? "Cloner le programme" : "Nouveau programme"}
      </DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Controller
              name="label"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Nom du programme"
                  fullWidth
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="breedKeys"
              control={control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  multiple
                  options={breeds.map((b: Breed) => b.code)}
                  getOptionLabel={(code) => breeds.find((b) => b.code === code)?.name ?? code}
                  value={field.value}
                  onChange={(_e, v) => field.onChange(v)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Races ciblées"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              )}
            />

            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Étapes du calendrier
            </Typography>
            <Stack spacing={2}>
              {fields.map((f, index) => (
                <Box
                  key={f.id}
                  sx={{
                    display: "flex",
                    gap: 1.5,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <Controller
                    name={`schedule.${index}.vaccineKey`}
                    control={control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        select
                        label="Vaccin"
                        sx={{ minWidth: 180, flex: 2 }}
                        error={!!fieldState.error}
                      >
                        {vaccines.map((v) => (
                          <MenuItem key={v.key} value={v.key}>
                            {v.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                  <Controller
                    name={`schedule.${index}.ageValue`}
                    control={control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        label="Âge"
                        type="number"
                        sx={{ width: 90 }}
                        error={!!fieldState.error}
                        slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                      />
                    )}
                  />
                  <Controller
                    name={`schedule.${index}.ageUnit`}
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} select label="Unité" sx={{ width: 100 }}>
                        <MenuItem value="DAY">Jours</MenuItem>
                        <MenuItem value="WEEK">Semaines</MenuItem>
                      </TextField>
                    )}
                  />
                  <Controller
                    name={`schedule.${index}.route`}
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} select label="Voie" sx={{ minWidth: 140, flex: 1 }}>
                        <MenuItem value="">—</MenuItem>
                        {Object.entries(HEALTH_ROUTE_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                  <Controller
                    name={`schedule.${index}.mandatory`}
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        sx={{ mr: 0 }}
                        control={<Checkbox checked={field.value} onChange={field.onChange} />}
                        label="Oblig."
                      />
                    )}
                  />
                  <IconButton
                    aria-label="Retirer l'étape"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                </Box>
              ))}
            </Stack>
            <Button
              startIcon={<Plus size={16} />}
              onClick={() => append(emptyEntry())}
              sx={{ alignSelf: "flex-start" }}
            >
              Ajouter une étape
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="contained" disabled={creating || updating}>
            Enregistrer
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
