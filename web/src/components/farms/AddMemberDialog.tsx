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
import { PhoneField } from "@/components/PhoneField";

const addMemberSchema = z.object({
  fullName: z.string().min(1, "Le nom complet est requis"),
  email: z.email("Adresse e-mail invalide"),
  // Obligatoire : c'est par ce numéro que le membre reçoit ses alertes WhatsApp.
  phone: z.string().min(1, "Numéro requis pour les alertes"),
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
  /**
   * Set when the address already belonged to an account: that person was attached to this farm
   * and keeps the password they already use. Without this flag the dialog would sit on the form
   * with no password to show, looking as if the save had failed.
   */
  const [attachedExisting, setAttachedExisting] = useState(false);

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
        phone: values.phone,
        role: values.role as FarmRole,
        ...(customize ? { permissions } : {}),
      };
      const result = await createMember({ farmId, body }).unwrap();
      if (result.temporaryPassword) {
        setTemporaryPassword(result.temporaryPassword);
      } else {
        setAttachedExisting(true);
      }
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
      {attachedExisting ? (
        <ExistingAccountAttached onDone={handleDone} />
      ) : temporaryPassword ? (
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
                    <PhoneField
                      value={field.value}
                      onChange={field.onChange}
                      label="Numéro"
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

/**
 * Shown when the address already had a Jawdi account.
 *
 * <p>That person was attached to this farm, not created: they keep the password they already
 * use, and will now see both farms behind one sign-in with a picker between them. Saying so
 * matters — the owner who just invited them would otherwise wonder where the password went.
 */
function ExistingAccountAttached({ onDone }: { onDone: () => void }) {
  return (
    <>
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Membre rattaché
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 1 }}>
          Cette personne avait déjà un compte Jawdi. Elle a été ajoutée à cette ferme et y accède
          avec son mot de passe habituel.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Aucun mot de passe temporaire n&apos;est créé : lui en imposer un nouveau lui ferait perdre
          l&apos;accès à ses autres fermes. À sa prochaine connexion, elle choisira entre elles.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onDone} variant="contained" color="primary">
          Terminé
        </Button>
      </DialogActions>
    </>
  );
}
