"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { X } from "lucide-react";
import {
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
} from "@/store/api/suppliersApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { colors } from "@/theme/tokens";
import type { Supplier } from "@/types";

const TYPE_OPTIONS = ["FEED", "MEDICATION", "EQUIPMENT", "MIXED"];
const TYPE_LABELS: Record<string, string> = {
  FEED: "Aliment",
  MEDICATION: "Médicaments",
  EQUIPMENT: "Équipement",
  MIXED: "Mixte",
};

export function SupplierDialog({
  open,
  onClose,
  farmId,
  supplier,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  supplier?: Supplier | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && <SupplierBody onClose={onClose} farmId={farmId} supplier={supplier} />}
    </Dialog>
  );
}

function SupplierBody({
  onClose,
  farmId,
  supplier,
}: {
  onClose: () => void;
  farmId: number;
  supplier?: Supplier | null;
}) {
  const { showToast } = useToast();
  const [create, { isLoading: creating }] = useCreateSupplierMutation();
  const [update, { isLoading: updating }] = useUpdateSupplierMutation();
  const isEdit = !!supplier;

  const [name, setName] = useState(supplier?.commercialName ?? "");
  const [contact, setContact] = useState(supplier?.contactPerson ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [city, setCity] = useState(supplier?.city ?? "");
  const [types, setTypes] = useState<string[]>(supplier?.types ?? []);
  const [paymentTerms, setPaymentTerms] = useState(supplier?.paymentTerms ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");

  const toggleType = (t: string) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const submit = async () => {
    const body = {
      commercialName: name.trim(),
      contactPerson: contact || undefined,
      phone: phone || undefined,
      email: email || undefined,
      city: city || undefined,
      types,
      paymentTerms: paymentTerms || undefined,
      notes: notes || undefined,
    };
    try {
      if (isEdit && supplier) {
        await update({ farmId, id: supplier.id, body }).unwrap();
        showToast("Fournisseur mis à jour.", "success");
      } else {
        await create({ farmId, body }).unwrap();
        showToast("Fournisseur créé.", "success");
      }
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const loading = creating || updating;

  return (
    <>
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {isEdit ? "Modifier le fournisseur" : "Nouveau fournisseur"}
        </Typography>
        <IconButton onClick={onClose} aria-label="Fermer" sx={{ position: "absolute", top: 12, right: 12 }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Nom commercial"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Personne contact" value={contact} onChange={(e) => setContact(e.target.value)} fullWidth />
            <TextField label="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <TextField label="Ville" value={city} onChange={(e) => setCity(e.target.value)} fullWidth />
          </Stack>
          <Box>
            <Typography variant="body2" sx={{ mb: 1, color: colors.neutral[700] }}>
              Types fournis
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              {TYPE_OPTIONS.map((t) => (
                <Chip
                  key={t}
                  label={TYPE_LABELS[t]}
                  onClick={() => toggleType(t)}
                  color={types.includes(t) ? "primary" : "default"}
                  variant={types.includes(t) ? "filled" : "outlined"}
                />
              ))}
            </Stack>
          </Box>
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
        <Button
          variant="contained"
          color="primary"
          disabled={!name.trim() || loading}
          onClick={submit}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {isEdit ? "Enregistrer" : "Créer"}
        </Button>
      </DialogActions>
    </>
  );
}
