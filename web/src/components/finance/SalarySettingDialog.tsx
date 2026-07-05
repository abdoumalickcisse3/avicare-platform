"use client";

import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import { useGetMembersQuery } from "@/store/api/membersApi";
import { useUpsertSalarySettingMutation } from "@/store/api/financeApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import type { SalarySetting } from "@/types";

const schema = z.object({
  userId: z.string().min(1, "Membre requis"),
  monthlySalaryXof: z
    .string()
    .regex(/^\d+$/, "Montant entier requis")
    .refine((v) => Number(v) > 0, "Le montant doit être supérieur à 0"),
  active: z.boolean(),
});

type SalarySettingForm = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  farmId: number;
  setting?: SalarySetting;
}

export function SalarySettingDialog({ open, onClose, farmId, setting }: Props) {
  const { showToast } = useToast();
  const { data: members = [] } = useGetMembersQuery(farmId, { skip: !open });
  const activeMembers = members.filter((m) => m.active);
  const [upsertSetting, { isLoading }] = useUpsertSalarySettingMutation();

  const defaults = useMemo<SalarySettingForm>(
    () => ({
      userId: setting ? String(setting.userId) : "",
      monthlySalaryXof: setting ? String(setting.monthlySalaryXof) : "",
      active: setting?.active ?? true,
    }),
    [setting],
  );

  const { control, handleSubmit, reset } = useForm<SalarySettingForm>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      reset(defaults);
    }
    wasOpen.current = open;
  }, [open, defaults, reset]);

  const onSubmit = async (values: SalarySettingForm) => {
    try {
      await upsertSetting({
        farmId,
        body: {
          userId: Number(values.userId),
          monthlySalaryXof: Number(values.monthlySalaryXof),
          active: values.active,
        },
      }).unwrap();
      showToast("Réglage de salaire enregistré.", "success");
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
            {setting ? "Modifier le salaire" : "Nouveau réglage de salaire"}
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
            <Controller
              name="userId"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  label="Membre"
                  fullWidth
                  disabled={!!setting}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                >
                  {activeMembers.map((m) => (
                    <MenuItem key={m.userId} value={String(m.userId)}>
                      {m.fullName}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="monthlySalaryXof"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Salaire mensuel"
                  fullWidth
                  slotProps={{
                    htmlInput: { inputMode: "numeric" },
                    input: { endAdornment: <InputAdornment position="end">XOF</InputAdornment> },
                  }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            {setting && (
              <Controller
                name="active"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                    }
                    label="Actif"
                  />
                )}
              />
            )}
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
            Enregistrer
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
