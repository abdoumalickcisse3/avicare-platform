"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { useCreatePartnerMutation } from "@/store/api/adminApi";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/feedback/ToastProvider";

/** The types the backend accepts today. Adding one is a migration, not a UI change. */
const TYPES = [
  { value: "FEED_SUPPLIER", label: "Provendier / fournisseur d'aliment" },
  { value: "VET", label: "Vétérinaire" },
];

/**
 * Registering a partner organisation.
 *
 * <p>Everything here was already possible through the API and impossible through the console, which
 * meant onboarding a feed supplier — the whole B2B2C channel — took a hand-written request. The
 * partner is created empty on purpose: attaching farms, issuing an invite code and creating the
 * first account are separate, deliberate steps on the detail screen, each of which opens a third
 * party's window onto a farmer's data.
 */
export function CreatePartnerDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (partnerId: number) => void;
}) {
  const { showToast } = useToast();
  const [createPartner, { isLoading }] = useCreatePartnerMutation();

  const [name, setName] = useState("");
  const [type, setType] = useState("FEED_SUPPLIER");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const reset = () => {
    setName("");
    setType("FEED_SUPPLIER");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
  };

  const submit = async () => {
    try {
      const partner = await createPartner({
        name: name.trim(),
        type,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
      }).unwrap();
      showToast(`${partner.name} enregistré`, "success");
      reset();
      onClose();
      onCreated?.(partner.id);
    } catch (e) {
      showToast(apiErrorMessage(e), "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nouveau partenaire</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          L&apos;organisation est créée seule, sans ferme ni compte. Le rattachement des élevages et
          la création des accès se font ensuite, depuis sa fiche — chacun ouvre une fenêtre sur les
          données d&apos;un éleveur.
        </DialogContentText>
        <Stack sx={{ gap: 2 }}>
          <TextField
            autoFocus
            required
            label="Nom de l'organisation"
            placeholder="ex. Sedima, Avisen, Cabinet vétérinaire de Thiès"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <TextField
            select
            required
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            helperText="Détermine ce que l'éleveur voit quand il choisit un partenaire à rejoindre."
            fullWidth
          >
            {TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Contact (nom)"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            fullWidth
          />
          <TextField
            label="Téléphone"
            placeholder="221XXXXXXXXX"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            fullWidth
          />
          <TextField
            label="Email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          disabled={name.trim().length === 0 || isLoading}
          onClick={submit}
        >
          Créer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
