"use client";

import { useState } from "react";
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
import { useGetCatalogQuery } from "@/store/api/catalogApi";
import { useGetClientsQuery } from "@/store/api/clientsApi";
import { useCreateOrderMutation } from "@/store/api/ordersApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { useProductionAvailability } from "./useProductionAvailability";
import type { ArticleSource, ProductType } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;

interface Line {
  /** Unique line key: "prod:BROILER:{unitId}" | "prod:EGGS" */
  key: string;
  articleKey: string;
  articleSource: ArticleSource;
  productType?: ProductType;
  productionUnitId?: number;
  label: string;
  unit: string;
  quantity: number;
  unitPriceXof: number;
  /** Front-side guard (soft): the backend is the real guard. */
  max?: number;
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
  const { data: clients } = useGetClientsQuery({ farmId });
  const { data: channels } = useGetCatalogQuery(
    { farmId, category: "sales_channels" },
    { skip: !farmId },
  );
  const [createOrder, { isLoading: saving }] = useCreateOrderMutation();
  const { broilerLots, eggsAvailable, loading } = useProductionAvailability(farmId);

  const [clientId, setClientId] = useState(defaultClientId != null ? String(defaultClientId) : "");
  const [expectedDate, setExpectedDate] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [picker, setPicker] = useState("");
  const [channel, setChannel] = useState<string>("");

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPriceXof, 0);
  const hasOverMax = lines.some((l) => l.max != null && l.quantity > l.max);

  const addLine = (value: string) => {
    if (!value) return;

    if (value.startsWith("prod:BROILER:")) {
      const unitId = Number(value.slice("prod:BROILER:".length));
      const lot = broilerLots.find((b) => b.unitId === unitId);
      if (!lot) return;
      const lineKey = value;
      if (lines.some((l) => l.key === lineKey)) {
        setPicker("");
        return;
      }
      setLines((cur) => [
        ...cur,
        {
          key: lineKey,
          articleKey: "BROILER",
          articleSource: "PRODUCTION",
          productType: "BROILER",
          productionUnitId: unitId,
          label: lot.label,
          unit: "tête",
          quantity: 1,
          unitPriceXof: 0,
          max: lot.heads,
        },
      ]);
      setPicker("");
      return;
    }

    if (value === "prod:EGGS") {
      const lineKey = "prod:EGGS";
      if (lines.some((l) => l.key === lineKey)) {
        setPicker("");
        return;
      }
      setLines((cur) => [
        ...cur,
        {
          key: lineKey,
          articleKey: "EGGS",
          articleSource: "PRODUCTION",
          productType: "EGGS",
          productionUnitId: undefined,
          label: "Œufs (plateaux)",
          unit: "plateau",
          quantity: 1,
          unitPriceXof: 0,
          max: eggsAvailable,
        },
      ]);
      setPicker("");
      return;
    }

    setPicker("");
  };

  const patch = (lineKey: string, p: Partial<Line>) =>
    setLines((cur) => cur.map((l) => (l.key === lineKey ? { ...l, ...p } : l)));
  const remove = (lineKey: string) => setLines((cur) => cur.filter((l) => l.key !== lineKey));

  const submit = async () => {
    try {
      await createOrder({
        farmId,
        body: {
          clientId: Number(clientId),
          expectedDeliveryDate: expectedDate || undefined,
          deliveryAddress: address || undefined,
          notes: notes || undefined,
          salesChannelKey: channel || undefined,
          lines: lines.map((l) => ({
            articleKey: l.articleKey,
            articleSource: l.articleSource,
            quantity: l.quantity,
            unitPriceXof: l.unitPriceXof,
            ...(l.articleSource === "PRODUCTION"
              ? { productType: l.productType, productionUnitId: l.productionUnitId }
              : {}),
          })),
        },
      }).unwrap();
      showToast("Commande créée.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const canSubmit = clientId !== "" && lines.length > 0 && !saving && !hasOverMax;

  const hasProduction = broilerLots.length > 0 || eggsAvailable > 0;

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

          <TextField
            select
            label="Circuit (optionnel)"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            fullWidth
          >
            <MenuItem value="">— Aucun —</MenuItem>
            {(channels ?? []).map((c) => (
              <MenuItem key={c.key} value={c.key}>
                {String(c.value.label ?? c.key)}
              </MenuItem>
            ))}
          </TextField>

          {/* Line editor */}
          <Box>
            <TextField
              select
              label="Ajouter de la production"
              value={picker}
              onChange={(e) => addLine(e.target.value)}
              fullWidth
              helperText={
                !loading && !hasProduction
                  ? "Aucune production à vendre — créez un lot de chair ou enregistrez du stock d'œufs"
                  : undefined
              }
            >
              {/* Production options */}
              {broilerLots
                .filter((lot) => !lines.some((l) => l.key === `prod:BROILER:${lot.unitId}`))
                .map((lot) => (
                  <MenuItem key={`prod:BROILER:${lot.unitId}`} value={`prod:BROILER:${lot.unitId}`}>
                    Lot {lot.label} — {lot.heads} têtes
                  </MenuItem>
                ))}
              {eggsAvailable > 0 && !lines.some((l) => l.key === "prod:EGGS") && (
                <MenuItem value="prod:EGGS">
                  Œufs — {eggsAvailable} plateaux
                </MenuItem>
              )}
            </TextField>

            {lines.length > 0 && (
              <Stack spacing={0} sx={{ mt: 2 }}>
                {lines.map((l) => (
                  <Box
                    key={l.key}
                    sx={{ borderBottom: `1px solid ${colors.neutral[100]}`, pb: 0.5, mb: 0.5 }}
                  >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 600 }}>{l.label}</Typography>
                        {l.articleSource === "PRODUCTION" && (
                          <Typography variant="caption" sx={{ color: colors.neutral[500] }}>
                            {l.unit}
                          </Typography>
                        )}
                      </Box>
                      <TextField
                        label="Qté"
                        value={l.quantity}
                        onChange={(e) =>
                          patch(l.key, { quantity: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })
                        }
                        size="small"
                        sx={{ width: 80, "& input": { ...mono, textAlign: "center" } }}
                        inputMode="numeric"
                      />
                      <TextField
                        label="PU"
                        value={l.unitPriceXof}
                        onChange={(e) =>
                          patch(l.key, { unitPriceXof: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })
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
                        onClick={() => remove(l.key)}
                        sx={{ color: colors.error.main }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Stack>
                    {l.max != null && l.quantity > l.max && (
                      <Typography
                        variant="caption"
                        sx={{ color: colors.error.main, display: "block" }}
                      >
                        Dépasse le disponible ({l.max})
                      </Typography>
                    )}
                  </Box>
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
