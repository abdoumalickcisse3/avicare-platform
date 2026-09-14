"use client";

import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import { useDeleteAccountMutation, useGetDeletionPreviewQuery } from "@/store/api/authApi";
import { apiErrorMessage } from "@/lib/apiError";
import { logout } from "@/store/authActions";
import { useAppDispatch } from "@/store/hooks";

/** Le mot à retaper. En majuscules : il ne se tape pas par distraction. */
const CONFIRMATION = "SUPPRIMER";

/**
 * Fermer son compte.
 *
 * Le pendant web de `DeleteAccountSheet` côté mobile, où la règle 5.1.1(v) de l'App Store
 * l'impose. Ici c'est la parité qui l'impose : une capacité qui existe sur un support existe sur
 * l'autre, et une suppression de compte disponible seulement sur téléphone serait une bizarrerie.
 *
 * La responsabilité qui compte est la même des deux côtés : **dire ce qui disparaît avant de le
 * demander.** Supprimer le compte d'un propriétaire efface ses fermes et tout ce qui en dépend —
 * bandes, ventes, factures, dépenses — et retire l'accès aux autres membres.
 */
export function DeleteAccountPanel({ open }: { open: boolean }) {
  const dispatch = useAppDispatch();
  // `skip` tant que l'onglet n'est pas ouvert : inutile d'interroger le serveur sur une
  // suppression que personne n'a encore envisagée.
  const { data: preview, isLoading: loadingPreview } = useGetDeletionPreviewQuery(undefined, {
    skip: !open,
  });
  const [deleteAccount, { isLoading: deleting }] = useDeleteAccountMutation();

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ownedFarms = preview?.ownedFarmCount ?? 0;
  const canSubmit =
    password.length > 0 && confirmation.trim().toUpperCase() === CONFIRMATION && !deleting;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await deleteAccount({ password }).unwrap();
      // Le compte n'existe plus : rester sur l'écran laisserait une session morte en place.
      await dispatch(logout());
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Cette action est <strong>définitive</strong>. Personne ne peut la remonter, nous non plus.
      </Typography>

      {loadingPreview ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Alert severity="error" icon={false}>
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.6 }}>
            CE QUI SERA EFFACÉ
          </Typography>
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
            {ownedFarms > 0 ? (
              <>
                <li>
                  {ownedFarms === 1 ? "Votre ferme" : `Vos ${ownedFarms} fermes`} et tout ce
                  qu&apos;{ownedFarms === 1 ? "elle contient" : "elles contiennent"} :{" "}
                  <strong>bandes, ventes, factures, dépenses, historique complet</strong>.
                </li>
                {/* Le point le plus grave, et celui qu'on oublie : d'autres personnes
                    travaillent peut-être sur cette ferme. */}
                <li>
                  L&apos;accès de <strong>tous les autres membres</strong> de
                  {ownedFarms === 1 ? " cette ferme" : " ces fermes"} — gérant, ouvriers,
                  vétérinaire.
                </li>
              </>
            ) : (
              <li>
                Votre compte et votre accès aux fermes dont vous êtes membre. Ces fermes ne vous
                appartenant pas, <strong>elles ne sont pas supprimées</strong>.
              </li>
            )}
            <li>Vos informations personnelles.</li>
          </Box>
        </Alert>
      )}

      {ownedFarms > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
          Si quelqu&apos;un doit reprendre {ownedFarms === 1 ? "la ferme" : "les fermes"},
          transférez la propriété avant de supprimer votre compte.
        </Typography>
      )}

      <TextField
        type="password"
        label="Votre mot de passe"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
        size="small"
        autoComplete="current-password"
      />
      <TextField
        label={`Tapez ${CONFIRMATION} pour confirmer`}
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        fullWidth
        size="small"
        slotProps={{ htmlInput: { autoCapitalize: "characters", autoCorrect: "off" } }}
      />

      {error && <Alert severity="error">{error}</Alert>}

      <Button
        variant="contained"
        color="error"
        onClick={submit}
        disabled={!canSubmit}
        sx={{ alignSelf: "flex-start" }}
      >
        {deleting ? "Suppression…" : "Supprimer définitivement"}
      </Button>
    </Stack>
  );
}
