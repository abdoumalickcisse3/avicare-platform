"use client";

import { useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
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
import { ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, X } from "lucide-react";
import {
  useGetStockItemsQuery,
  useRecordMovementMutation,
} from "@/store/api/inventoryStockApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import {
  MOVEMENT_REASON_LABELS,
  REASONS_BY_TYPE,
  formatQty,
} from "@/lib/inventory";
import { colors } from "@/theme/tokens";
import type { MovementType } from "@/types";

const TYPES: {
  value: MovementType;
  label: string;
  icon: typeof ArrowUpCircle;
  color: string;
  bg: string;
}[] = [
  { value: "IN", label: "Entrée", icon: ArrowUpCircle, color: colors.success.main, bg: colors.success.light },
  { value: "OUT", label: "Sortie", icon: ArrowDownCircle, color: colors.error.main, bg: colors.error.light },
  { value: "ADJUSTMENT", label: "Ajustement", icon: SlidersHorizontal, color: colors.info.main, bg: colors.info.light },
];

const QUICK = [10, 50, 100];

export function StockMovementDialog({
  open,
  onClose,
  farmId,
  preselectStockItemId,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  preselectStockItemId?: number;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <StockMovementBody onClose={onClose} farmId={farmId} preselectStockItemId={preselectStockItemId} />
      )}
    </Dialog>
  );
}

function StockMovementBody({
  onClose,
  farmId,
  preselectStockItemId,
}: {
  onClose: () => void;
  farmId: number;
  preselectStockItemId?: number;
}) {
  const { showToast } = useToast();
  const { data: stockItems = [] } = useGetStockItemsQuery({ farmId });
  const [recordMovement, { isLoading }] = useRecordMovementMutation();

  const [type, setType] = useState<MovementType>("IN");
  const [selectedId, setSelectedId] = useState<number | null>(preselectStockItemId ?? null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<string>(REASONS_BY_TYPE.IN[0]);
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");

  const activeItems = useMemo(() => stockItems.filter((s) => s.active), [stockItems]);
  const item = useMemo(
    () => stockItems.find((s) => s.id === selectedId) ?? null,
    [stockItems, selectedId],
  );

  const changeType = (t: MovementType) => {
    setType(t);
    setReason(REASONS_BY_TYPE[t][0]);
  };

  const quantity = qty ? Number(qty.replace(",", ".")) : NaN;
  const current = item?.currentQuantity ?? null;
  const after = useMemo(() => {
    if (current == null || !Number.isFinite(quantity)) return null;
    if (type === "IN") return current + quantity;
    if (type === "OUT") return current - quantity;
    return quantity; // ADJUSTMENT = counted absolute target
  }, [current, quantity, type]);

  const addQuick = (n: number) =>
    setQty((q) => String((q ? Number(q.replace(",", ".")) : 0) + n));

  const canSubmit =
    !!item && Number.isFinite(quantity) && quantity >= 0 && !!reason && !isLoading;

  const submit = async () => {
    if (!item) return;
    try {
      await recordMovement({
        farmId,
        body: {
          stockItemId: item.id,
          movementType: type,
          quantity,
          reason: reason as never,
          movementDate,
          unitPriceXof: type === "IN" && unitPrice ? Number(unitPrice) : undefined,
          notes: notes || undefined,
        },
      }).unwrap();
      showToast("Mouvement enregistré.", "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  return (
    <>
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Nouveau mouvement de stock
        </Typography>
        <IconButton onClick={onClose} aria-label="Fermer" sx={{ position: "absolute", top: 12, right: 12 }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5 }}>
            {TYPES.map((t) => {
              const Icon = t.icon;
              const selected = type === t.value;
              return (
                <ButtonBase
                  key={t.value}
                  onClick={() => changeType(t.value)}
                  aria-pressed={selected}
                  sx={{
                    flexDirection: "column",
                    gap: 0.5,
                    py: 1.5,
                    borderRadius: 2,
                    border: `1.5px solid ${selected ? t.color : colors.neutral[200]}`,
                    bgcolor: selected ? t.bg : "transparent",
                    transition: "all 120ms",
                  }}
                >
                  <Icon size={22} color={t.color} />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {t.label}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Autocomplete
              sx={{ flex: 1 }}
              options={activeItems}
              getOptionLabel={(o) => o.articleKey}
              value={item}
              onChange={(_e, v) => setSelectedId(v?.id ?? null)}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={(params) => <TextField {...params} label="Article" />}
            />
            <Box
              sx={{
                minWidth: 120,
                px: 2,
                py: 1,
                borderRadius: 2,
                bgcolor: colors.neutral[50],
                border: `1px solid ${colors.neutral[200]}`,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Stock actuel
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                {current != null ? formatQty(current, item?.unit) : "—"}
              </Typography>
            </Box>
          </Stack>

          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
              <TextField
                label={type === "ADJUSTMENT" ? "Quantité comptée (cible)" : "Quantité"}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                type="number"
                fullWidth
                slotProps={{
                  htmlInput: { inputMode: "decimal", min: 0, step: "0.01" },
                  input: item?.unit
                    ? { endAdornment: <InputAdornment position="end">{item.unit}</InputAdornment> }
                    : undefined,
                }}
              />
              <Stack direction="row" spacing={0.5}>
                {QUICK.map((n) => (
                  <Button key={n} size="small" variant="outlined" onClick={() => addQuick(n)}>
                    +{n}
                  </Button>
                ))}
              </Stack>
            </Stack>
            {after != null && (
              <Typography
                variant="caption"
                sx={{
                  mt: 0.5,
                  display: "block",
                  fontFamily: "var(--font-mono)",
                  fontVariantNumeric: "tabular-nums",
                  color: after < 0 ? colors.warning.dark : colors.neutral[500],
                  fontWeight: after < 0 ? 700 : 500,
                }}
              >
                Stock après mouvement : {formatQty(after, item?.unit)}
                {after < 0 ? " — négatif (autorisé)" : ""}
              </Typography>
            )}
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Date"
              type="date"
              value={movementDate}
              onChange={(e) => setMovementDate(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField select label="Motif" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth>
              {REASONS_BY_TYPE[type].map((r) => (
                <MenuItem key={r} value={r}>
                  {MOVEMENT_REASON_LABELS[r]}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {type === "IN" && (
            <TextField
              label="Prix unitaire (XOF)"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              type="number"
              fullWidth
              slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
            />
          )}

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informations complémentaires sur ce mouvement…"
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
          disabled={!canSubmit}
          onClick={submit}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Enregistrer
        </Button>
      </DialogActions>
    </>
  );
}
