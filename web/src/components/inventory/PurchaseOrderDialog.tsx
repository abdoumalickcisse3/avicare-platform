"use client";

import { useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
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
import { Plus, Trash2, X } from "lucide-react";
import {
  useCreatePurchaseOrderMutation,
  useSubmitPurchaseOrderMutation,
} from "@/store/api/purchaseOrdersApi";
import { useGetSuppliersQuery } from "@/store/api/suppliersApi";
import { useGetAllArticlesQuery } from "@/store/api/inventoryCatalogApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";
import type { InventoryCatalogItem } from "@/types";

interface LineDraft {
  article: InventoryCatalogItem | null;
  qty: string;
  unitPrice: string;
}

const emptyLine = (): LineDraft => ({ article: null, qty: "", unitPrice: "" });

export function PurchaseOrderDialog({
  open,
  onClose,
  farmId,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      {open && <PurchaseOrderBody onClose={onClose} farmId={farmId} />}
    </Dialog>
  );
}

function PurchaseOrderBody({ onClose, farmId }: { onClose: () => void; farmId: number }) {
  const { showToast } = useToast();
  const { data: suppliers = [] } = useGetSuppliersQuery({ farmId });
  const { data: articles = [] } = useGetAllArticlesQuery({ farmId });
  const [createPo, { isLoading: creating }] = useCreatePurchaseOrderMutation();
  const [submitPo, { isLoading: submitting }] = useSubmitPurchaseOrderMutation();

  const [supplierId, setSupplierId] = useState<number | "">("");
  const [expected, setExpected] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const lineTotal = (l: LineDraft) => {
    const q = Number(l.qty.replace(",", "."));
    const p = Number(l.unitPrice);
    return Number.isFinite(q) && Number.isFinite(p) ? q * p : 0;
  };
  const total = useMemo(() => lines.reduce((s, l) => s + lineTotal(l), 0), [lines]);

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((cur) => cur.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((cur) => [...cur, emptyLine()]);
  const removeLine = (i: number) =>
    setLines((cur) => (cur.length > 1 ? cur.filter((_l, idx) => idx !== i) : cur));

  const validLines = lines.filter(
    (l) => l.article && Number(l.qty.replace(",", ".")) > 0 && Number(l.unitPrice) > 0,
  );
  const canSubmit = supplierId !== "" && validLines.length > 0;

  const buildBody = () => ({
    supplierId: supplierId as number,
    expectedDeliveryDate: expected || undefined,
    lines: validLines.map((l) => ({
      articleKey: l.article!.articleKey,
      articleSource: l.article!.articleSource,
      orderedQuantity: Number(l.qty.replace(",", ".")),
      unitPriceXof: Number(l.unitPrice),
    })),
  });

  const save = async (thenSubmit: boolean) => {
    try {
      const po = await createPo({ farmId, body: buildBody() }).unwrap();
      if (thenSubmit) {
        await submitPo({ farmId, id: po.id }).unwrap();
        showToast("Bon d'achat envoyé au fournisseur.", "success");
      } else {
        showToast("Brouillon enregistré.", "success");
      }
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const busy = creating || submitting;

  return (
    <>
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Nouveau bon d&apos;achat
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
              label="Fournisseur"
              value={supplierId}
              onChange={(e) => setSupplierId(Number(e.target.value))}
              fullWidth
              required
            >
              {suppliers.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.commercialName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Livraison prévue"
              type="date"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>

          <Typography variant="body2" sx={{ fontWeight: 600, color: colors.neutral[700] }}>
            Lignes de commande
          </Typography>
          <Stack spacing={1.5}>
            {lines.map((l, i) => (
              <Stack key={i} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: "center" }}>
                <Autocomplete
                  sx={{ flex: 2, width: "100%" }}
                  options={articles}
                  getOptionLabel={(o) => o.label}
                  value={l.article}
                  onChange={(_e, v) => setLine(i, { article: v })}
                  isOptionEqualToValue={(o, v) => o.articleKey === v.articleKey}
                  renderInput={(params) => <TextField {...params} label="Article" size="small" />}
                />
                <TextField
                  label="Qté"
                  value={l.qty}
                  onChange={(e) => setLine(i, { qty: e.target.value })}
                  type="number"
                  size="small"
                  sx={{ flex: 1, width: "100%" }}
                  slotProps={{ htmlInput: { inputMode: "decimal", min: 0 } }}
                />
                <TextField
                  label="Prix unit. (F)"
                  value={l.unitPrice}
                  onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                  type="number"
                  size="small"
                  sx={{ flex: 1, width: "100%" }}
                  slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                />
                <Box
                  sx={{
                    minWidth: 90,
                    textAlign: "right",
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 14,
                  }}
                >
                  {formatCurrency(lineTotal(l))}
                </Box>
                <IconButton aria-label="Supprimer la ligne" onClick={() => removeLine(i)} size="small">
                  <Trash2 size={18} color={colors.error.main} />
                </IconButton>
              </Stack>
            ))}
          </Stack>
          <Button startIcon={<Plus size={18} />} onClick={addLine} sx={{ alignSelf: "flex-start" }}>
            Ajouter une ligne
          </Button>

          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: `1px solid ${colors.neutral[200]}`,
              pt: 2,
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              Total
            </Typography>
            <Typography
              variant="h6"
              sx={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}
            >
              {formatCurrency(total)}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Annuler
        </Button>
        <Button onClick={() => save(false)} disabled={!canSubmit || busy} variant="outlined">
          Enregistrer brouillon
        </Button>
        <Button
          onClick={() => save(true)}
          disabled={!canSubmit || busy}
          variant="contained"
          color="primary"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Envoyer au fournisseur
        </Button>
      </DialogActions>
    </>
  );
}
