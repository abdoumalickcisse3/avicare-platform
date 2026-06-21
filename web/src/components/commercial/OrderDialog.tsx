"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
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
import { Plus, Trash2, X } from "lucide-react";
import { useGetInventoryArticlesQuery } from "@/store/api/inventoryCatalogApi";
import { useGetClientsQuery } from "@/store/api/clientsApi";
import { useCreateOrderMutation } from "@/store/api/ordersApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

interface Line {
  articleKey: string;
  label: string;
  unit: string;
  quantity: number;
  unitPriceXof: number;
}

export function OrderDialog({
  open,
  onClose,
  farmId,
  defaultClientId,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  defaultClientId?: number;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      {open && <OrderBody onClose={onClose} farmId={farmId} defaultClientId={defaultClientId} />}
    </Dialog>
  );
}

function OrderBody({
  onClose,
  farmId,
  defaultClientId,
}: {
  onClose: () => void;
  farmId: number;
  defaultClientId?: number;
}) {
  const { showToast } = useToast();
  const { data: articles } = useGetInventoryArticlesQuery({ farmId });
  const { data: clients } = useGetClientsQuery({ farmId });
  const [createOrder, { isLoading: saving }] = useCreateOrderMutation();

  const [clientId, setClientId] = useState(defaultClientId != null ? String(defaultClientId) : "");
  const [expectedDate, setExpectedDate] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [picker, setPicker] = useState("");

  const products = useMemo(
    () => (articles ?? []).filter((a) => a.subcategory === "PRODUCT"),
    [articles],
  );
  const total = lines.reduce((s, l) => s + l.quantity * l.unitPriceXof, 0);

  const addLine = (articleKey: string) => {
    const a = products.find((p) => p.articleKey === articleKey);
    if (!a || lines.some((l) => l.articleKey === articleKey)) return;
    setLines((cur) => [
      ...cur,
      {
        articleKey: a.articleKey,
        label: a.label,
        unit: a.unit ?? "u",
        quantity: 1,
        unitPriceXof: a.typicalUnitPriceXof ?? 0,
      },
    ]);
    setPicker("");
  };
  const patch = (key: string, p: Partial<Line>) =>
    setLines((cur) => cur.map((l) => (l.articleKey === key ? { ...l, ...p } : l)));
  const remove = (key: string) => setLines((cur) => cur.filter((l) => l.articleKey !== key));

  const submit = async () => {
    try {
      await createOrder({
        farmId,
        body: {
          clientId: Number(clientId),
          expectedDeliveryDate: expectedDate || undefined,
          deliveryAddress: address || undefined,
          notes: notes || undefined,
          lines: lines.map((l) => ({
            articleKey: l.articleKey,
            articleSource: "INVENTORY",
            quantity: l.quantity,
            unitPriceXof: l.unitPriceXof,
          })),
        },
      }).unwrap();
      showToast("Commande créée.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const canSubmit = clientId !== "" && lines.length > 0 && !saving;

  return (
    <>
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Nouvelle commande
        </Typography>
        <IconButton onClick={onClose} aria-label="Fermer" sx={{ position: "absolute", top: 12, right: 12 }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="Client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              fullWidth
              required
            >
              {(clients ?? []).length === 0 && <MenuItem value="" disabled>Aucun client</MenuItem>}
              {(clients ?? []).map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {c.displayName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Livraison prévue"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>

          {/* Line editor */}
          <Box>
            <TextField
              select
              label="Ajouter un article"
              value={picker}
              onChange={(e) => addLine(e.target.value)}
              fullWidth
              helperText={products.length === 0 ? "Aucun produit dans la bibliothèque" : undefined}
            >
              {products
                .filter((p) => !lines.some((l) => l.articleKey === p.articleKey))
                .map((p) => (
                  <MenuItem key={p.articleKey} value={p.articleKey}>
                    {p.label} — {formatCurrency(p.typicalUnitPriceXof ?? 0)}/{p.unit ?? "u"}
                  </MenuItem>
                ))}
            </TextField>

            {lines.length > 0 && (
              <Stack spacing={1} sx={{ mt: 2 }}>
                {lines.map((l) => (
                  <Stack
                    key={l.articleKey}
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center" }}
                  >
                    <Typography sx={{ flex: 1, fontWeight: 600 }}>{l.label}</Typography>
                    <TextField
                      label="Qté"
                      value={l.quantity}
                      onChange={(e) =>
                        patch(l.articleKey, { quantity: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })
                      }
                      size="small"
                      sx={{ width: 80, "& input": { ...mono, textAlign: "center" } }}
                      inputMode="numeric"
                    />
                    <TextField
                      label="PU"
                      value={l.unitPriceXof}
                      onChange={(e) =>
                        patch(l.articleKey, { unitPriceXof: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })
                      }
                      size="small"
                      sx={{ width: 110, "& input": mono }}
                      inputMode="numeric"
                    />
                    <Typography sx={{ ...mono, width: 110, textAlign: "right", fontWeight: 600 }}>
                      {formatCurrency(l.quantity * l.unitPriceXof)}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label="Retirer"
                      onClick={() => remove(l.articleKey)}
                      sx={{ color: colors.error.main }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>

          <TextField
            label="Adresse de livraison"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            fullWidth
          />
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />

          {lines.length === 0 && (
            <Alert severity="info">Ajoutez au moins un article à la commande.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
        <Typography sx={{ ...mono, fontWeight: 700, fontSize: 18, color: colors.primary[600] }}>
          {formatCurrency(total)}
        </Typography>
        <Box>
          <Button onClick={onClose} color="inherit">
            Annuler
          </Button>
          <Button onClick={submit} variant="contained" startIcon={<Plus size={16} />} disabled={!canSubmit}>
            Créer la commande
          </Button>
        </Box>
      </DialogActions>
    </>
  );
}
