"use client";

import { useState } from "react";
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
import { Egg, Drumstick, Minus, Plus, Trash2, X } from "lucide-react";
import { useGetCatalogQuery } from "@/store/api/catalogApi";
import { useGetClientsQuery } from "@/store/api/clientsApi";
import { useLazyGetPerformanceQuery } from "@/store/api/poultryBatchesApi";
import { useCreateSaleMutation } from "@/store/api/salesApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/commercial";
import { formatCurrency } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { useProductionAvailability } from "./useProductionAvailability";
import type { ArticleSource, PaymentMethod, ProductType } from "@/types";

const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" } as const;
const WALK_IN = "__walk_in__";

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
  /** Ligne chair uniquement : bascule le calcul du prix sur le poids plutôt que sur les têtes. */
  pricingMode?: "HEAD" | "WEIGHT";
  /**
   * Saisie brute du poids, gardée en texte : « 30. » est un état intermédiaire légitime au
   * clavier. Convertie en nombre au dernier moment (affichage du montant et envoi du payload).
   */
  weightKg?: string;
  /**
   * Dernière valeur proposée par la pesée — sert à savoir si `weightKg` est encore la suggestion
   * de la machine (donc recalculable quand le nombre de têtes change) ou une saisie de l'éleveur.
   */
  suggestedWeightKg?: string;
}

/** Digits + un seul point : laisse passer « 30. » sans le casser. Virgule (clavier fr-SN) traitée comme point. */
function sanitizeDecimal(raw: string): string {
  const cleaned = raw.replace(",", ".").replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot < 0) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

/** Le poids saisi, en nombre — NaN tant que la saisie n'est pas exploitable. */
function parseWeight(weightKg?: string): number {
  return Number.parseFloat(weightKg ?? "");
}

function hasUsableWeight(l: Line): boolean {
  const n = parseWeight(l.weightKg);
  return Number.isFinite(n) && n > 0;
}

/** Poids suggéré (kg) pour `quantity` têtes d'après la dernière pesée du lot. */
function suggestWeight(quantity: number, currentWeightG?: number | null): string | undefined {
  if (currentWeightG == null) return undefined;
  return String(Math.round((quantity * currentWeightG) / 10) / 100);
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
  const { data: clients } = useGetClientsQuery({ farmId });
  const { data: channels } = useGetCatalogQuery(
    { farmId, category: "sales_channels" },
    { skip: !farmId },
  );
  const [createSale, { isLoading: saving }] = useCreateSaleMutation();
  const { broilerLots, eggsAvailable, loading } = useProductionAvailability(farmId);

  const [lines, setLines] = useState<Line[]>([]);
  const [clientId, setClientId] = useState<string>(WALK_IN);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [channel, setChannel] = useState<string>("");

  const [fetchPerformance] = useLazyGetPerformanceQuery();
  const [weighingHintByUnitId, setWeighingHintByUnitId] = useState<
    Record<number, { currentWeightG: number | null; snapshotDate: string | null }>
  >({});

  const lineAmount = (l: Line) => {
    if (l.pricingMode !== "WEIGHT") return l.quantity * l.unitPriceXof;
    /*
     * En mode poids, `unitPriceXof` est un prix AU KILO : retomber sur les têtes donnerait un
     * montant plausible mais faux (80 têtes × 1 500 F/kg). Tant que le poids n'est pas saisi, on
     * n'affiche rien et le bouton Valider reste bloqué (voir hasInvalidWeight).
     */
    return hasUsableWeight(l) ? parseWeight(l.weightKg) * l.unitPriceXof : 0;
  };

  const total = lines.reduce((s, l) => s + lineAmount(l), 0);
  const hasOverMax = lines.some((l) => l.max != null && l.quantity > l.max);
  const hasInvalidWeight = lines.some((l) => l.pricingMode === "WEIGHT" && !hasUsableWeight(l));

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
        : cur.map((l) => {
            if (l.key !== lineKey) return l;
            const next = { ...l, quantity: qty };
            /*
             * Le poids suggéré vaut pour un nombre de têtes donné : si l'éleveur change les têtes
             * après avoir basculé au poids, la suggestion doit suivre. On ne recalcule que tant
             * qu'elle n'a pas été retouchée — une vraie pesée saisie n'est jamais écrasée.
             */
            if (l.pricingMode !== "WEIGHT" || l.weightKg !== l.suggestedWeightKg) return next;
            const hint =
              l.productionUnitId != null ? weighingHintByUnitId[l.productionUnitId] : undefined;
            const suggested = suggestWeight(qty, hint?.currentWeightG);
            return { ...next, weightKg: suggested, suggestedWeightKg: suggested };
          }),
    );
  const setPrice = (lineKey: string, price: number) =>
    setLines((cur) => cur.map((l) => (l.key === lineKey ? { ...l, unitPriceXof: price } : l)));

  const setPricingMode = async (lineKey: string, mode: "HEAD" | "WEIGHT", unitId?: number) => {
    if (mode === "HEAD") {
      setLines((cur) =>
        cur.map((l) =>
          l.key === lineKey
            ? { ...l, pricingMode: "HEAD", weightKg: undefined, suggestedWeightKg: undefined }
            : l,
        ),
      );
      return;
    }
    let hint = unitId != null ? weighingHintByUnitId[unitId] : undefined;
    if (unitId != null && !hint) {
      try {
        const perf = await fetchPerformance({ farmId, batchId: unitId }).unwrap();
        hint = { currentWeightG: perf.currentWeightG, snapshotDate: perf.snapshotDate };
      } catch {
        hint = { currentWeightG: null, snapshotDate: null };
      }
      setWeighingHintByUnitId((cur) => ({ ...cur, [unitId]: hint! }));
    }
    setLines((cur) =>
      cur.map((l) => {
        if (l.key !== lineKey) return l;
        const suggested = suggestWeight(l.quantity, hint?.currentWeightG);
        return {
          ...l,
          pricingMode: "WEIGHT",
          weightKg: l.weightKg ? l.weightKg : suggested,
          suggestedWeightKg: suggested,
        };
      }),
    );
  };

  const setWeight = (lineKey: string, weightKg: string) =>
    setLines((cur) =>
      cur.map((l) => (l.key === lineKey ? { ...l, weightKg: sanitizeDecimal(weightKg) } : l)),
    );

  const submit = async () => {
    if (lines.length === 0) return;
    try {
      await createSale({
        farmId,
        body: {
          clientId: clientId === WALK_IN ? null : Number(clientId),
          paymentMethod: method,
          salesChannelKey: channel || undefined,
          lines: lines.map((l) => ({
            articleKey: l.articleKey,
            articleSource: l.articleSource,
            quantity: l.quantity,
            unitPriceXof: l.unitPriceXof,
            ...(l.pricingMode === "WEIGHT" && hasUsableWeight(l)
              ? { weightKg: parseWeight(l.weightKg) }
              : {}),
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

      {/* Body: production picker + cart */}
      <Box sx={{ px: 3, flex: 1, overflowY: "auto" }}>
        {loading && <Typography color="text.secondary">Chargement de la production…</Typography>}
        {!loading && !hasProduction && (
          <Alert severity="info">
            Aucune production à vendre pour le moment. Créez un lot de volaille de chair ou enregistrez
            du stock d&apos;œufs (plateaux) pour pouvoir vendre.
          </Alert>
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
                  {l.productType === "BROILER" && (
                    <Stack direction="row" spacing={0.5}>
                      <Button
                        size="small"
                        variant={l.pricingMode !== "WEIGHT" ? "contained" : "outlined"}
                        onClick={() => setPricingMode(l.key, "HEAD")}
                      >
                        À la tête
                      </Button>
                      <Button
                        size="small"
                        variant={l.pricingMode === "WEIGHT" ? "contained" : "outlined"}
                        onClick={() => setPricingMode(l.key, "WEIGHT", l.productionUnitId)}
                      >
                        Au poids
                      </Button>
                    </Stack>
                  )}
                  {l.pricingMode === "WEIGHT" && (
                    <Box>
                      <TextField
                        label="Poids total (kg)"
                        type="text"
                        value={l.weightKg ?? ""}
                        onChange={(e) => setWeight(l.key, e.target.value)}
                        size="small"
                        sx={{ width: 120 }}
                        slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: "0.01" } }}
                      />
                      {weighingHintByUnitId[l.productionUnitId ?? -1]?.currentWeightG != null ? (
                        <Typography variant="caption" sx={{ color: colors.neutral[500], display: "block" }}>
                          Estimé d&apos;après la pesée du{" "}
                          {weighingHintByUnitId[l.productionUnitId ?? -1]?.snapshotDate}
                        </Typography>
                      ) : (
                        <Typography variant="caption" sx={{ color: colors.neutral[500], display: "block" }}>
                          Aucune pesée enregistrée — saisissez le poids réel.
                        </Typography>
                      )}
                    </Box>
                  )}
                  <TextField
                    value={l.unitPriceXof}
                    onChange={(e) =>
                      setPrice(l.key, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)
                    }
                    size="small"
                    label={l.pricingMode === "WEIGHT" ? "Prix au kg" : "PU"}
                    sx={{ width: 96, "& input": { ...mono } }}
                    inputMode="numeric"
                  />
                  <Typography sx={{ ...mono, width: 96, textAlign: "right", fontWeight: 600 }}>
                    {formatCurrency(lineAmount(l))}
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
                {l.pricingMode === "WEIGHT" && !hasUsableWeight(l) && (
                  <Typography
                    variant="caption"
                    sx={{ color: colors.error.main, display: "block", pb: 0.5 }}
                  >
                    Poids requis — le prix saisi est au kilo.
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
        <TextField
          select
          size="small"
          label="Circuit (optionnel)"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          sx={{ mb: 2, minWidth: 220 }}
        >
          <MenuItem value="">— Aucun —</MenuItem>
          {(channels ?? []).map((c) => (
            <MenuItem key={c.key} value={c.key}>
              {String(c.value.label ?? c.key)}
            </MenuItem>
          ))}
        </TextField>
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
            disabled={lines.length === 0 || saving || hasOverMax || hasInvalidWeight}
            sx={{ px: 4, py: 1.5 }}
          >
            Valider la vente
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
