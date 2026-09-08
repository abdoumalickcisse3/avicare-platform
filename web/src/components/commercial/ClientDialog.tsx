"use client";

import { useState } from "react";
import {
  Box,
  Button,
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
import {
  useCreateClientMutation,
  useUpdateClientMutation,
} from "@/store/api/clientsApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { CLIENT_TYPE_LABELS, CLIENT_TYPE_OPTIONS } from "@/lib/commercial";
import type { Client, ClientType } from "@/types";

export function ClientDialog({
  open,
  onClose,
  farmId,
  client,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  client?: Client | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && <ClientBody onClose={onClose} farmId={farmId} client={client} />}
    </Dialog>
  );
}

function ClientBody({
  onClose,
  farmId,
  client,
}: {
  onClose: () => void;
  farmId: number;
  client?: Client | null;
}) {
  const { showToast } = useToast();
  const [create, { isLoading: creating }] = useCreateClientMutation();
  const [update, { isLoading: updating }] = useUpdateClientMutation();
  const isEdit = !!client;

  const [clientType, setClientType] = useState<ClientType>(
    client?.clientType ?? "INDIVIDUAL",
  );
  const [displayName, setDisplayName] = useState(client?.displayName ?? "");
  const [legalName, setLegalName] = useState(client?.legalName ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [city, setCity] = useState(client?.city ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [creditLimit, setCreditLimit] = useState(
    client?.creditLimitXof != null ? String(client.creditLimitXof) : "",
  );
  const [paymentTerms, setPaymentTerms] = useState(client?.defaultPaymentTerms ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(client?.notifyWhatsapp ?? false);
  const hasPhone = phone.trim().length > 0;

  const submit = async () => {
    const trimmedLimit = creditLimit.trim();
    const body = {
      clientType,
      displayName: displayName.trim(),
      legalName: legalName || undefined,
      phone: phone || undefined,
      email: email || undefined,
      city: city || undefined,
      address: address || undefined,
      creditLimitXof: trimmedLimit === "" ? null : Number(trimmedLimit),
      defaultPaymentTerms: paymentTerms || undefined,
      notes: notes || undefined,
      // Toujours explicite : le PUT remplace, et omis ce champ vaut `false` — il révoquerait le
      // consentement du client sans que personne l'ait voulu. Un consentement sans numéro n'a
      // nulle part où aller, donc il ne s'enregistre pas non plus.
      notifyWhatsapp: hasPhone && notifyWhatsapp,
    };
    try {
      if (isEdit && client) {
        await update({ farmId, id: client.id, body }).unwrap();
        showToast("Client mis à jour.", "success");
      } else {
        await create({ farmId, body }).unwrap();
        showToast("Client créé.", "success");
      }
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const loading = creating || updating;
  const canSubmit = displayName.trim().length > 0 && !loading;

  return (
    <>
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {isEdit ? "Modifier le client" : "Nouveau client"}
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
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="Type"
              value={clientType}
              onChange={(e) => setClientType(e.target.value as ClientType)}
              fullWidth
            >
              {CLIENT_TYPE_OPTIONS.map((t) => (
                <MenuItem key={t} value={t}>
                  {CLIENT_TYPE_LABELS[t]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Nom affiché"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              fullWidth
              required
            />
          </Stack>
          {clientType !== "INDIVIDUAL" && (
            <TextField
              label="Raison sociale"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              fullWidth
            />
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Ville" value={city} onChange={(e) => setCity(e.target.value)} fullWidth />
            <TextField
              label="Limite de crédit"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value.replace(/[^0-9]/g, ""))}
              fullWidth
              inputMode="numeric"
              helperText="Vide = aucune limite (indicatif)"
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">XOF</InputAdornment>,
                },
              }}
            />
          </Stack>
          <TextField label="Adresse" value={address} onChange={(e) => setAddress(e.target.value)} fullWidth />
          <TextField
            select
            label="Conditions de paiement"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            fullWidth
          >
            <MenuItem value="">—</MenuItem>
            <MenuItem value="COMPTANT">Comptant</MenuItem>
            <MenuItem value="30J">30 jours</MenuItem>
            <MenuItem value="60J">60 jours</MenuItem>
          </TextField>
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          {/* Écrire au client d'un éleveur engage le nom de l'éleveur auprès de SES clients :
              cela s'accorde, cela ne se suppose pas. Sans numéro, il n'y a nulle part où
              écrire — la case est alors désactivée et dit pourquoi. */}
          <FormControlLabel
            control={
              <Switch
                checked={hasPhone && notifyWhatsapp}
                onChange={(e) => setNotifyWhatsapp(e.target.checked)}
                disabled={!hasPhone}
                // Nommé explicitement : le libellé est un bloc de deux lignes, dont MUI ne tire
                // aucun nom accessible — sans cela, un lecteur d'écran annonce une case sans
                // objet. `slotProps.input` et non `inputProps`, déprécié en MUI v9.
                slotProps={{ input: { "aria-label": "Prévenir par WhatsApp" } }}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Prévenir par WhatsApp</Typography>
                <Typography variant="caption" color="text.secondary">
                  {hasPhone
                    ? "Facture émise et paiement reçu."
                    : "Renseignez un téléphone pour activer les avis."}
                </Typography>
              </Box>
            }
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Annuler
        </Button>
        <Button onClick={submit} variant="contained" disabled={!canSubmit}>
          {isEdit ? "Enregistrer" : "Créer"}
        </Button>
      </DialogActions>
    </>
  );
}
