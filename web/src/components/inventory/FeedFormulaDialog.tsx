"use client";

import { useMemo, useState } from "react";
import {
  Alert,
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
  useCreateFeedFormulaMutation,
  useUpdateFeedFormulaMutation,
} from "@/store/api/feedFormulasApi";
import { useGetAllArticlesQuery } from "@/store/api/inventoryCatalogApi";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { formatCurrency } from "@/lib/format";
import { FEED_PHASE_LABELS } from "@/lib/inventory";
import { colors } from "@/theme/tokens";
import type { ArticleSource, FeedFormula, FeedPhase } from "@/types";

interface IngredientDraft {
  articleKey: string | null;
  articleSource: ArticleSource;
  percentage: string;
}

const PHASES = Object.keys(FEED_PHASE_LABELS) as FeedPhase[];

export function FeedFormulaDialog({
  open,
  onClose,
  farmId,
  formula,
}: {
  open: boolean;
  onClose: () => void;
  farmId: number;
  formula?: FeedFormula | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && <FeedFormulaBody onClose={onClose} farmId={farmId} formula={formula} />}
    </Dialog>
  );
}

function FeedFormulaBody({
  onClose,
  farmId,
  formula,
}: {
  onClose: () => void;
  farmId: number;
  formula?: FeedFormula | null;
}) {
  const { showToast } = useToast();
  const { data: articles = [] } = useGetAllArticlesQuery({ farmId });
  const [create, { isLoading: creating }] = useCreateFeedFormulaMutation();
  const [update, { isLoading: updating }] = useUpdateFeedFormulaMutation();
  const isEdit = !!formula;

  const inventoryArticles = useMemo(
    () => articles.filter((a) => a.articleSource === "INVENTORY"),
    [articles],
  );
  const priceByKey = useMemo(
    () => Object.fromEntries(articles.map((a) => [a.articleKey, a.typicalUnitPriceXof ?? 0])),
    [articles],
  );

  const [name, setName] = useState(formula?.name ?? "");
  const [phase, setPhase] = useState<FeedPhase>(formula?.targetPhase ?? "STARTER");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    formula
      ? formula.ingredients.map((ing) => ({
          articleKey: ing.articleKey,
          articleSource: ing.articleSource,
          percentage: String(ing.percentage),
        }))
      : [{ articleKey: null, articleSource: "INVENTORY", percentage: "" }],
  );

  const setIng = (i: number, patch: Partial<IngredientDraft>) =>
    setIngredients((cur) => cur.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addIng = () =>
    setIngredients((cur) => [...cur, { articleKey: null, articleSource: "INVENTORY", percentage: "" }]);
  const removeIng = (i: number) =>
    setIngredients((cur) => (cur.length > 1 ? cur.filter((_x, idx) => idx !== i) : cur));

  const pct = (s: string) => {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const sumPct = useMemo(() => ingredients.reduce((s, x) => s + pct(x.percentage), 0), [ingredients]);
  // % = kg per 100kg → cost/100kg = Σ percentage × unitPrice.
  const estimatedCost = useMemo(
    () =>
      ingredients.reduce(
        (s, x) => s + (x.articleKey ? pct(x.percentage) * (priceByKey[x.articleKey] ?? 0) : 0),
        0,
      ),
    [ingredients, priceByKey],
  );

  const validIngredients = ingredients.filter((x) => x.articleKey && pct(x.percentage) > 0);
  const canSubmit = name.trim().length > 0 && validIngredients.length > 0;

  const submit = async () => {
    const body = {
      name: name.trim(),
      targetPhase: phase,
      ingredients: validIngredients.map((x) => ({
        articleKey: x.articleKey!,
        articleSource: x.articleSource,
        percentage: pct(x.percentage),
      })),
    };
    try {
      if (isEdit && formula) {
        await update({ farmId, id: formula.id, body }).unwrap();
        showToast("Formule mise à jour.", "success");
      } else {
        await create({ farmId, body }).unwrap();
        showToast("Formule créée.", "success");
      }
      onClose();
    } catch (err) {
      showToast(apiErrorMessage(err), "error");
    }
  };

  const loading = creating || updating;
  const sumOff = Math.abs(sumPct - 100) > 0.01;

  return (
    <>
      <DialogTitle component="div" sx={{ pr: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {isEdit ? "Modifier la formule" : "Nouvelle formule d'aliment"}
        </Typography>
        <IconButton onClick={onClose} aria-label="Fermer" sx={{ position: "absolute", top: 12, right: 12 }}>
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
            <TextField
              select
              label="Phase"
              value={phase}
              onChange={(e) => setPhase(e.target.value as FeedPhase)}
              fullWidth
            >
              {PHASES.map((p) => (
                <MenuItem key={p} value={p}>
                  {FEED_PHASE_LABELS[p]}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Typography variant="body2" sx={{ fontWeight: 600, color: colors.neutral[700] }}>
            Composition (pour 100 kg)
          </Typography>
          <Stack spacing={1.5}>
            {ingredients.map((x, i) => (
              <Stack key={i} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Autocomplete
                  sx={{ flex: 2 }}
                  options={inventoryArticles}
                  getOptionLabel={(o) => o.label}
                  value={inventoryArticles.find((a) => a.articleKey === x.articleKey) ?? null}
                  onChange={(_e, v) =>
                    setIng(i, {
                      articleKey: v?.articleKey ?? null,
                      articleSource: v?.articleSource ?? "INVENTORY",
                    })
                  }
                  isOptionEqualToValue={(o, v) => o.articleKey === v.articleKey}
                  renderInput={(params) => <TextField {...params} label="Ingrédient" size="small" />}
                />
                <TextField
                  label="%"
                  value={x.percentage}
                  onChange={(e) => setIng(i, { percentage: e.target.value })}
                  type="number"
                  size="small"
                  sx={{ width: 100 }}
                  slotProps={{ htmlInput: { inputMode: "decimal", min: 0, max: 100 } }}
                />
                <IconButton aria-label="Supprimer" onClick={() => removeIng(i)} size="small">
                  <Trash2 size={18} color={colors.error.main} />
                </IconButton>
              </Stack>
            ))}
          </Stack>
          <Button startIcon={<Plus size={18} />} onClick={addIng} sx={{ alignSelf: "flex-start" }}>
            Ajouter un ingrédient
          </Button>

          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Somme
              </Typography>
              <Typography
                sx={{
                  fontFamily: "var(--font-mono)",
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 700,
                  color: sumOff ? colors.warning.dark : colors.success.dark,
                }}
              >
                {sumPct.toFixed(1)} %
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography variant="caption" color="text.secondary">
                Coût estimé / 100 kg
              </Typography>
              <Typography sx={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                {formatCurrency(Math.round(estimatedCost))}
              </Typography>
            </Box>
          </Box>

          {sumOff && validIngredients.length > 0 && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              La somme des pourcentages est de {sumPct.toFixed(1)} % (≠ 100 %). Vous pouvez
              enregistrer une formule en cours de calibrage.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Annuler
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={!canSubmit || loading}
          onClick={submit}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {isEdit ? "Enregistrer" : "Créer"}
        </Button>
      </DialogActions>
    </>
  );
}
