"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import { useCreateMemberMutation } from "@/store/api/membersApi";
import { useGetPermissionCatalogQuery } from "@/store/api/permissionsApi";
import { PermissionEditor } from "./PermissionEditor";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";
import { ASSIGNABLE_FARM_ROLES, FARM_ROLE_LABELS } from "@/constants/farmRoles";
import type { FarmRole } from "@/types";

const addMemberSchema = z.object({
  fullName: z.string().min(1, "Le nom complet est requis"),
  email: z.email("Adresse e-mail invalide"),
  phone: z.string().optional(),
  role: z.enum(["MANAGER", "FARMER", "VETERINARIAN", "BUYER"]),
});

type AddMemberForm = z.infer<typeof addMemberSchema>;

const DEFAULT_VALUES: AddMemberForm = {
  fullName: "",
  email: "",
  phone: "",
  role: "FARMER",
};

interface AddMemberDialogProps {
  open: boolean;
  onClose: () => void;
  farmId: number;
}

/**
 * Creates a brand-new member account on the farm (fullName + email + role,
 * optional permission customization) and reveals the generated temporary
 * password once (Task 8, design Stitch 4524f35d).
 */
export function AddMemberDialog({ open, onClose, farmId }: AddMemberDialogProps) {
  const { showToast } = useToast();
  const [createMember, { isLoading }] = useCreateMemberMutation();
  const { data: catalog, isLoading: catalogLoading } = useGetPermissionCatalogQuery();

  const [customize, setCustomize] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const { control, handleSubmit, reset } = useForm<AddMemberForm>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const role = useWatch({ control, name: "role" });

  // reset() is the RHF-sanctioned way to reload form fields on (re)open.
  useEffect(() => {
    if (open) {
      reset(DEFAULT_VALUES);
    }
  }, [open, reset]);

  // Render-phase resets (per React docs "you might not need an effect"):
  // whenever the dialog (re)opens we clear the customize toggle, temp password,
  // and force a permission reseed — even if the role value is unchanged. The
  // role/catalog change below then re-seeds permissions to the role defaults,
  // which also covers the catalog arriving after the dialog is already open.
  const [wasOpen, setWasOpen] = useState(open);
  const [seededRole, setSeededRole] = useState<string | null>(null);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCustomize(false);
      setTemporaryPassword(null);
      setSeededRole(null);
    }
  }

  if (open && catalog && seededRole !== role) {
    setSeededRole(role);
    setPermissions(catalog.roleDefaults[role] ?? []);
  }

  const onSubmit = async (values: AddMemberForm) => {
    try {
      const body = {
        fullName: values.fullName,
        email: values.email,
        ...(values.phone ? { phone: values.phone } : {}),
        role: values.role as FarmRole,
        ...(customize ? { permissions } : {}),
      };
      const result = await createMember({ farmId, body }).unwrap();
      setTemporaryPassword(result.temporaryPassword);
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const handleCopy = () => {
    if (temporaryPassword) {
      navigator.clipboard.writeText(temporaryPassword);
    }
  };

  const handleDone = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: `${16}px` } } }}
    >
      {temporaryPassword ? (
        <>
          <DialogTitle component="div" sx={{ pr: 6 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Compte créé
            </Typography>
            <IconButton
              onClick={handleDone}
              aria-label="Fermer"
              sx={{ position: "absolute", top: 12, right: 12 }}
            >
              <X size={20} />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <Alert severity="success">
                Le compte a été créé avec succès.
              </Alert>
              <Stack spacing={0.5}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Mot de passe temporaire
                </Typography>
                <Box
                  sx={{
                    border: `1px solid ${colors.neutral[200]}`,
                    borderRadius: 2,
                    px: 2,
                    py: 1.5,
                    bgcolor: colors.neutral[50],
                  }}
                >
                  <Typography sx={{ fontFamily: "monospace", fontWeight: 600 }}>
                    {temporaryPassword}
                  </Typography>
                </Box>
              </Stack>
              <Button onClick={handleCopy} variant="outlined">
                Copier
              </Button>
              <Typography variant="body2" color="text.secondary">
                Notez-le, il ne sera plus affiché.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleDone} variant="contained" color="primary">
              Terminé
            </Button>
          </DialogActions>
        </>
      ) : (
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogTitle component="div" sx={{ pr: 6 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Ajouter un membre
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Un nouveau compte Jawdi sera créé pour ce membre.
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
                name="fullName"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Nom complet"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />

              <Stack direction="row" spacing={2}>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Numéro"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  name="email"
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Adresse e-mail"
                      type="email"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Stack>

              <Controller
                name="role"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    select
                    label="Rôle"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message ??
                      "Les accès par défaut du rôle sont appliqués."
                    }
                  >
                    {ASSIGNABLE_FARM_ROLES.map((r) => (
                      <MenuItem key={r} value={r}>
                        {FARM_ROLE_LABELS[r]}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              <Alert severity="info">
                Un mot de passe temporaire sera généré et affiché après la création.
              </Alert>

              <Stack spacing={0.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={customize}
                      disabled={catalogLoading}
                      onChange={(e) => setCustomize(e.target.checked)}
                    />
                  }
                  label="Personnaliser les accès"
                />
                <Typography variant="caption" color="text.secondary">
                  Laisser les défauts est recommandé.
                </Typography>
              </Stack>

              {customize && catalog && (
                <PermissionEditor
                  catalog={catalog}
                  value={permissions}
                  onChange={setPermissions}
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
              disabled={isLoading}
              startIcon={
                isLoading ? <CircularProgress size={16} color="inherit" /> : null
              }
              sx={{
                bgcolor: colors.accent[400],
                "&:hover": { bgcolor: colors.accent[500] },
              }}
            >
              Créer le compte
            </Button>
          </DialogActions>
        </Box>
      )}
    </Dialog>
  );
}
