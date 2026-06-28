"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Egg, Drumstick, Minus, Package, Plus, Trash2, X } from "lucide-react";
import { useGetInventoryArticlesQuery } from "@/store/api/inventoryCatalogApi";
import { useGetClientsQuery } from "@/store/api/clientsApi";
import { useCreateSaleMutation } from "@/store/api/salesApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/commercial";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { useProductionAvailability } from "./useProductionAvailability";
import type { ArticleSource, InventoryCatalogItem, PaymentMethod, ProductType } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;
const WALK_IN = "__walk_in__";

interface Line {
  /** Unique line key: "inv:{articleKey}" | "prod:BROILER:{unitId}" | "prod:EGGS" */
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

/** Pick an icon for a product article from its key/label — small touch of identity. */
function articleIcon(key: string) {
  const k = key.toLowerCase();
  if (k.includes("egg") || k.includes("oeuf")) return Egg;
  if (k.includes("chicken") || k.includes("poulet") || k.includes("meat")) return Drumstick;
  return Package;
}

export function QuickSaleDialog({
  open,
  onClose,
  farmId,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md">
      {open && <QuickSaleBody onClose={onClose} farmId={farmId} />}
    </Dialog>
  );
}

function QuickSaleBody({ onClose, farmId }: { onClose: () => void; farmId: number }) {
  const { showToast } = useToast();
  const { data: articles, isLoading: articlesLoading } = useGetInventoryArticlesQuery({ farmId });
  const { data: clients } = useGetClientsQuery({ farmId });
  const [createSale, { isLoading: saving }] = useCreateSaleMutation();
  const { broilerLots, eggsAvailable } = useProductionAvailability(farmId);

  const [lines, setLines] = useState<Line[]>([]);
  const [clientId, setClientId] = useState<string>(WALK_IN);
  const [method, setMethod] = useState<PaymentMethod>("CASH");

  const products = useMemo(
    () => (articles ?? []).filter((a) => a.subcategory === "PRODUCT"),
    [articles],
  );

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPriceXof, 0);
  const hasOverMax = lines.some((l) => l.max != null && l.quantity > l.max);

  const addArticle = (a: InventoryCatalogItem) => {
    const lineKey = `inv:${a.articleKey}`;
    setLines((cur) => {
      const i = cur.findIndex((l) => l.key === lineKey);
      if (i >= 0) {
        const next = [...cur];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [
        ...cur,
        {
          key: lineKey,
          articleKey: a.articleKey,
          articleSource: "INVENTORY",
          label: a.label,
          unit: a.unit ?? "u",
          quantity: 1,
          unitPriceXof: a.typicalUnitPriceXof ?? 0,
        },
      ];
    });
  };

  const addBroilerLot = (unitId: number, label: string, heads: number) => {
    const lineKey = `prod:BROILER:${unitId}`;
    setLines((cur) => {
      const i = cur.findIndex((l) => l.key === lineKey);
      if (i >= 0) {
        const next = [...cur];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [
        ...cur,
        {
          key: lineKey,
          articleKey: "BROILER",
          articleSource: "PRODUCTION",
          productType: "BROILER",
          productionUnitId: unitId,
          label,
          unit: "tête",
          quantity: 1,
          unitPriceXof: 0,
          max: heads,
        },
      ];
    });
  };

  const addEggs = () => {
    const lineKey = "prod:EGGS";
    setLines((cur) => {
      const i = cur.findIndex((l) => l.key === lineKey);
      if (i >= 0) {
        const next = [...cur];
        next[i] = { ...next[i], quantity: next[i].quantity + 1 };
        return next;
      }
      return [
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
      ];
    });
  };

  const setQty = (lineKey: string, qty: number) =>
    setLines((cur) =>
      qty <= 0
        ? cur.filter((l) => l.key !== lineKey)
        : cur.map((l) => (l.key === lineKey ? { ...l, quantity: qty } : l)),
    );
  const setPrice = (lineKey: string, price: number) =>
    setLines((cur) => cur.map((l) => (l.key === lineKey ? { ...l, unitPriceXof: price } : l)));

  const submit = async () => {
    if (lines.length === 0) return;
    try {
      await createSale({
        farmId,
        body: {
          clientId: clientId === WALK_IN ? null : Number(clientId),
          paymentMethod: method,
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
      showToast(`Vente enregistrée — ${formatCurrency(total)}`, "success");
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const hasProduction = broilerLots.length > 0 || eggsAvailable > 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: { xs: "100%", sm: "auto" } }}>
      {/* Header */}
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", px: 3, py: 2 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Vente directe
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <TextField
            select
            size="small"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value={WALK_IN}>Client de passage</MenuItem>
            {(clients ?? []).map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>
                {c.displayName}
              </MenuItem>
            ))}
          </TextField>
          <IconButton onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </IconButton>
        </Stack>
      </Stack>

      {/* Body: article picker + cart */}
      <Box sx={{ px: 3, flex: 1, overflowY: "auto" }}>
        {articlesLoading && <Typography color="text.secondary">Chargement des articles…</Typography>}
        {!articlesLoading && products.length === 0 && (
          <Alert severity="info">
            Aucun article « produit » à vendre. Ajoutez des produits (œufs, poulets…) à la
            bibliothèque d&apos;articles.
          </Alert>
        )}

        {products.length > 0 && (
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" },
              mb: 3,
            }}
          >
            {products.map((a) => {
              const Icon = articleIcon(a.articleKey);
              return (
                <Box
                  key={a.articleKey}
                  role="button"
                  tabIndex={0}
                  onClick={() => addArticle(a)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && addArticle(a)}
                  sx={{
                    cursor: "pointer",
                    border: `1px solid ${colors.neutral[200]}`,
                    borderRadius: 3,
                    p: 2,
                    transition: "all .12s",
                    "&:hover": { borderColor: colors.primary[400], bgcolor: colors.primary[50] },
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                    <Avatar
                      sx={{ width: 34, height: 34, bgcolor: colors.primary[100], color: colors.primary[700] }}
                    >
                      <Icon size={18} />
                    </Avatar>
                    <Typography sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>
                      {a.label}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ ...mono, color: colors.neutral[500] }}>
                    {formatCurrency(a.typicalUnitPriceXof ?? 0)}/{a.unit ?? "u"}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Production de la ferme */}
        {hasProduction && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="overline"
              sx={{ color: colors.neutral[500], display: "block", mb: 1.5 }}
            >
              Production de la ferme
            </Typography>
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" },
              }}
            >
              {broilerLots.map((lot) => (
                <Box
                  key={lot.unitId}
                  role="button"
                  tabIndex={0}
                  onClick={() => addBroilerLot(lot.unitId, lot.label, lot.heads)}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") &&
                    addBroilerLot(lot.unitId, lot.label, lot.heads)
                  }
                  sx={{
                    cursor: "pointer",
                    border: `1px solid ${colors.neutral[200]}`,
                    borderRadius: 3,
                    p: 2,
                    transition: "all .12s",
                    "&:hover": { borderColor: colors.accent[400], bgcolor: colors.accent[50] },
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                    <Avatar
                      sx={{ width: 34, height: 34, bgcolor: colors.accent[100], color: colors.accent[700] }}
                    >
                      <Drumstick size={18} />
                    </Avatar>
                    <Typography sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>
                      {lot.label}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ ...mono, color: colors.neutral[500] }}>
                    {lot.heads} têtes restantes
                  </Typography>
                </Box>
              ))}

              {eggsAvailable > 0 && (
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={addEggs}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && addEggs()}
                  sx={{
                    cursor: "pointer",
                    border: `1px solid ${colors.neutral[200]}`,
                    borderRadius: 3,
                    p: 2,
                    transition: "all .12s",
                    "&:hover": { borderColor: colors.accent[400], bgcolor: colors.accent[50] },
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                    <Avatar
                      sx={{ width: 34, height: 34, bgcolor: colors.accent[100], color: colors.accent[700] }}
                    >
                      <Egg size={18} />
                    </Avatar>
                    <Typography sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>
                      Œufs
                    </Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ ...mono, color: colors.neutral[500] }}>
                    {eggsAvailable} plateaux disponibles
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Cart */}
        {lines.length > 0 && (
          <Stack spacing={0} sx={{ mb: 2 }}>
            {lines.map((l) => (
              <Box
                key={l.key}
                sx={{ borderBottom: `1px solid ${colors.neutral[100]}` }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: "center", py: 1 }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>{l.label}</Typography>
                    {l.articleSource === "PRODUCTION" && (
                      <Typography variant="caption" sx={{ color: colors.neutral[500] }}>
                        {l.unit}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                    <IconButton size="small" onClick={() => setQty(l.key, l.quantity - 1)}>
                      <Minus size={16} />
                    </IconButton>
                    <TextField
                      value={l.quantity}
                      onChange={(e) =>
                        setQty(l.key, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)
                      }
                      size="small"
                      sx={{ width: 56, "& input": { textAlign: "center", ...mono } }}
                      inputMode="numeric"
                    />
                    <IconButton size="small" onClick={() => setQty(l.key, l.quantity + 1)}>
                      <Plus size={16} />
                    </IconButton>
                  </Stack>
                  <TextField
                    value={l.unitPriceXof}
                    onChange={(e) =>
                      setPrice(l.key, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)
                    }
                    size="small"
                    label="PU"
                    sx={{ width: 96, "& input": { ...mono } }}
                    inputMode="numeric"
                  />
                  <Typography sx={{ ...mono, width: 96, textAlign: "right", fontWeight: 600 }}>
                    {formatCurrency(l.quantity * l.unitPriceXof)}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label="Retirer"
                    onClick={() => setQty(l.key, 0)}
                    sx={{ color: colors.error.main }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </Stack>
                {l.max != null && l.quantity > l.max && (
                  <Typography
                    variant="caption"
                    sx={{ color: colors.error.main, display: "block", pb: 0.5 }}
                  >
                    Dépasse le disponible ({l.max})
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {/* Sticky footer: payment + total + validate */}
      <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${colors.neutral[200]}`, bgcolor: colors.neutral[0] }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }} useFlexGap>
          {PAYMENT_METHOD_OPTIONS.map((m) => (
            <Button
              key={m}
              onClick={() => setMethod(m)}
              variant={method === m ? "contained" : "outlined"}
              color={method === m ? "primary" : "inherit"}
              size="small"
            >
              {PAYMENT_METHOD_LABELS[m]}
            </Button>
          ))}
        </Stack>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Total
            </Typography>
            <Typography variant="h4" sx={{ ...mono, fontWeight: 700, color: colors.primary[600] }}>
              {formatCurrency(total)}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            onClick={submit}
            disabled={lines.length === 0 || saving || hasOverMax}
            sx={{ px: 4, py: 1.5 }}
          >
            Valider la vente
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
