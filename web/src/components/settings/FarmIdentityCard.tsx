"use client";

import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ImageUp, Trash2 } from "lucide-react";
import {
  useDeleteFarmLogoMutation,
  useGetFarmLogoQuery,
  useGetFarmQuery,
  useUpdateFarmMutation,
  useUploadFarmLogoMutation,
} from "@/store/api/farmsApi";
import { colors } from "@/theme/tokens";

/** Ce que le backend accepte (FarmLogoService). Annoncé à l'utilisateur AVANT l'échec. */
const ACCEPTED = "image/png,image/jpeg";
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * L'identité que la ferme présente à ses clients : son logo, son NINEA, son RC.
 *
 * Ces trois éléments ne servent qu'à une chose — figurer sur la facture et le bon
 * de livraison que l'éleveur remet. D'où leur place à part, et le fait que seul
 * le propriétaire les modifie : c'est l'exploitation qui s'engage, pas un
 * réglage d'usage courant.
 */
export function FarmIdentityCard({ farmId }: { farmId: number }) {
  const { data: farm } = useGetFarmQuery(farmId);
  const { data: logo, isFetching: loadingLogo } = useGetFarmLogoQuery(
    { id: farmId, version: farm?.logoUpdatedAt ?? "" },
    { skip: !farm?.logoUpdatedAt },
  );
  const [upload, { isLoading: uploading }] = useUploadFarmLogoMutation();
  const [removeLogo, { isLoading: removing }] = useDeleteFarmLogoMutation();
  const [updateFarm, { isLoading: saving }] = useUpdateFarmMutation();

  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [ninea, setNinea] = useState<string | null>(null);
  const [rccm, setRccm] = useState<string | null>(null);

  if (!farm) return null;

  // Les champs suivent la ferme jusqu'à la première frappe, puis l'utilisateur.
  const nineaValue = ninea ?? farm.ninea ?? "";
  const rccmValue = rccm ?? farm.rccm ?? "";

  const pick = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    // Contrôlé ici aussi : prévenir avant l'envoi vaut mieux qu'un aller-retour
    // sur une connexion lente pour s'entendre dire non.
    if (!ACCEPTED.split(",").includes(file.type)) {
      setError("Le logo doit être une image PNG ou JPEG.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("L'image ne doit pas dépasser 2 Mo.");
      return;
    }
    try {
      await upload({ id: farmId, file }).unwrap();
    } catch {
      setError("Le logo n'a pas pu être enregistré. Réessayez.");
    }
  };

  const saveIdentity = async () => {
    setError(null);
    setSaved(false);
    try {
      await updateFarm({
        id: farmId,
        // PUT de remplacement : on renvoie la ferme entière, sinon les champs
        // omis seraient effacés.
        body: {
          name: farm.name,
          description: farm.description ?? undefined,
          location: farm.location ?? undefined,
          capacity: farm.capacity ?? undefined,
          productionFocus: farm.productionFocus,
          ninea: nineaValue.trim() || null,
          rccm: rccmValue.trim() || null,
        },
      }).unwrap();
      setSaved(true);
    } catch {
      setError("L'enregistrement a échoué. Réessayez.");
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Identité sur vos factures
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Ce logo et ces mentions apparaissent sur les factures et les bons de livraison que vous
          remettez à vos clients.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {saved && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>
            Enregistré.
          </Alert>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 128,
              height: 128,
              flexShrink: 0,
              borderRadius: 2,
              border: `1px dashed ${colors.neutral[300]}`,
              bgcolor: colors.neutral[50],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {loadingLogo || uploading ? (
              <CircularProgress size={24} />
            ) : logo ? (
              <Box
                component="img"
                src={logo}
                alt={`Logo de ${farm.name}`}
                sx={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", px: 1 }}>
                Aucun logo
              </Typography>
            )}
          </Box>

          <Stack spacing={1.5} sx={{ flex: 1, width: "100%" }}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<ImageUp size={16} />}
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                {farm.logoUpdatedAt ? "Remplacer" : "Ajouter un logo"}
              </Button>
              {farm.logoUpdatedAt && (
                <Button
                  color="error"
                  startIcon={<Trash2 size={16} />}
                  disabled={removing}
                  onClick={() => removeLogo(farmId)}
                >
                  Retirer
                </Button>
              )}
            </Stack>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED}
              hidden
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                // Remis à zéro pour que rechoisir le même fichier redéclenche l'envoi.
                e.target.value = "";
              }}
            />
            <Typography variant="caption" color="text.secondary">
              PNG ou JPEG, 2 Mo maximum. L&apos;image est réduite automatiquement — inutile
              d&apos;envoyer un fichier lourd.
            </Typography>
          </Stack>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 4 }}>
          <TextField
            label="NINEA"
            value={nineaValue}
            onChange={(e) => setNinea(e.target.value)}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 50 } }}
            helperText="Identifiant fiscal"
          />
          <TextField
            label="Registre du commerce"
            value={rccmValue}
            onChange={(e) => setRccm(e.target.value)}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 50 } }}
            helperText="RC, facultatif"
          />
        </Stack>

        <Button variant="contained" onClick={saveIdentity} disabled={saving} sx={{ mt: 2 }}>
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}
