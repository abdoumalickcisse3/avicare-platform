"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
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
