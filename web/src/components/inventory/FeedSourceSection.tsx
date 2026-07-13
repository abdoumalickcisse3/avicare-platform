"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  FormControl,
  FormControlLabel,
  InputAdornment,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useGetAllArticlesQuery } from "@/store/api/inventoryCatalogApi";
import { useGetAvailableFormulasQuery } from "@/store/api/feedFormulasApi";
import { useGetStockItemsQuery } from "@/store/api/inventoryStockApi";
import { findStockByArticle, formatQty } from "@/lib/inventory";
import { colors } from "@/theme/tokens";
import type {
  FeedFormulaRef,
  InventoryCatalogItem,
  StockConsumption,
} from "@/types";

type Mode = "none" | "article" | "formula";

interface FormulaOption {
  label: string;
  kind: "Plateforme" | "Ferme";
  formulaKey?: string;
  formulaId?: number;
  ingredients: { articleKey: string; percentage: number }[];
}

interface Props {
  farmId: number;
  /** Whether the host dialog is open (gates the queries). */
  open: boolean;
  onChange: (
    feedConsumption: StockConsumption | null,
    feedFormula: FeedFormulaRef | null,
  ) => void;
}

/**
 * Feed-source selector for the daily-record dialogs (broiler + layer). Three exclusive modes:
 * no coupling, a single standard article (D18), or a feed formula decomposed into per-ingredient
 * OUT movements (D20 révisée). Emits at most one of the two payloads. Shows the resulting stock
 * (orange when negative — non-blocking, D19). The host renders this only when module.inventory is
 * active (useInventoryGating).
 */
export function FeedSourceSection({ farmId, open, onChange }: Props) {
  const [mode, setMode] = useState<Mode>("none");
  const [article, setArticle] = useState<InventoryCatalogItem | null>(null);
  const [qty, setQty] = useState("");
  const [formula, setFormula] = useState<FormulaOption | null>(null);
  const [totalKg, setTotalKg] = useState("");

  const { data: articles = [] } = useGetAllArticlesQuery({ farmId }, { skip: !open });
  const { data: stockItems = [] } = useGetStockItemsQuery({ farmId }, { skip: !open });
  const { data: available } = useGetAvailableFormulasQuery({ farmId }, { skip: !open });

  const feedArticles = useMemo(
    () => articles.filter((a) => a.articleSource === "INVENTORY"),
    [articles],
  );

  const formulaOptions = useMemo<FormulaOption[]>(() => {
    const platform = (available?.platformFormulas ?? []).map((p) => ({
      label: p.label,
      kind: "Plateforme" as const,
      formulaKey: p.key,
      ingredients: p.ingredients,
    }));
    const farm = (available?.farmFormulas ?? []).map((f) => ({
      label: f.name,
      kind: "Ferme" as const,
      formulaId: f.id,
      ingredients: f.ingredients,
    }));
    return [...farm, ...platform];
  }, [available]);

  const emit = (
    m: Mode,
    a: InventoryCatalogItem | null,
    q: string,
    f: FormulaOption | null,
    kg: string,
  ) => {
    if (m === "article") {
      const n = q ? Number(q.replace(",", ".")) : NaN;
      if (a && Number.isFinite(n) && n > 0) {
        onChange({ articleKey: a.articleKey, articleSource: a.articleSource, quantity: n }, null);
        return;
      }
    } else if (m === "formula") {
      const n = kg ? Number(kg.replace(",", ".")) : NaN;
      if (f && Number.isFinite(n) && n > 0) {
        onChange(null, {
          ...(f.formulaKey ? { formulaKey: f.formulaKey } : { formulaId: f.formulaId }),
          totalKg: n,
        });
        return;
      }
    }
    onChange(null, null);
  };

  // Reset to a clean state on each open (mount) and clear the parent's held value.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- edge-triggered reset on `open`, not a render-driven sync */
    setMode("none");
    setArticle(null);
    setQty("");
    setFormula(null);
    setTotalKg("");
    /* eslint-enable react-hooks/set-state-in-effect */
    onChange(null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalKgNum = totalKg ? Number(totalKg.replace(",", ".")) : NaN;
  const current = article
    ? (findStockByArticle(stockItems, article.articleKey)?.currentQuantity ?? 0)
    : null;
  const after = current != null && Number.isFinite(Number(qty.replace(",", ".")))
    ? current - Number(qty.replace(",", "."))
    : null;

  return (
    <Box sx={{ border: `1px solid ${colors.neutral[200]}`, borderRadius: 2, p: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        Aliment distribué
      </Typography>
      <FormControl>
        <RadioGroup
          row
          value={mode}
          onChange={(e) => {
            const m = e.target.value as Mode;
            setMode(m);
            emit(m, article, qty, formula, totalKg);
          }}
        >
          <FormControlLabel value="none" control={<Radio size="small" />} label="Aucun" />
          <FormControlLabel value="article" control={<Radio size="small" />} label="Article" />
          <FormControlLabel value="formula" control={<Radio size="small" />} label="Formule" />
        </RadioGroup>
      </FormControl>

      {mode === "article" && (
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Autocomplete
            options={feedArticles}
            getOptionLabel={(o) => o.label}
            value={article}
            onChange={(_e, v) => {
              setArticle(v);
              emit("article", v, qty, formula, totalKg);
            }}
            isOptionEqualToValue={(o, v) => o.articleKey === v.articleKey}
            renderInput={(params) => (
              <TextField {...params} label="Article à décompter" size="small" />
            )}
          />
          <TextField
            label="Quantité consommée"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              emit("article", article, e.target.value, formula, totalKg);
            }}
            type="number"
            size="small"
            slotProps={{
              htmlInput: { inputMode: "decimal", min: 0, step: "0.01" },
              input: article?.unit
                ? { endAdornment: <InputAdornment position="end">{article.unit}</InputAdornment> }
                : undefined,
            }}
          />
          {after != null && (
            <Typography
              variant="caption"
              sx={{
                fontFamily: "var(--font-mono)",
                color: after < 0 ? colors.warning.dark : colors.neutral[500],
                fontWeight: after < 0 ? 700 : 500,
              }}
            >
              Stock après : {formatQty(after, article?.unit)}
              {after < 0 ? " — stock négatif (autorisé)" : ""}
            </Typography>
          )}
        </Stack>
      )}

      {mode === "formula" && (
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Autocomplete
            options={formulaOptions}
            groupBy={(o) => o.kind}
            getOptionLabel={(o) => o.label}
            value={formula}
            onChange={(_e, v) => {
              setFormula(v);
              emit("formula", article, qty, v, totalKg);
            }}
            isOptionEqualToValue={(o, v) =>
              o.formulaKey === v.formulaKey && o.formulaId === v.formulaId
            }
            renderInput={(params) => <TextField {...params} label="Formule" size="small" />}
          />
          <TextField
            label="Total aliment (kg)"
            value={totalKg}
            onChange={(e) => {
              setTotalKg(e.target.value);
              emit("formula", article, qty, formula, e.target.value);
            }}
            type="number"
            size="small"
            slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: "0.1" } }}
          />
          {formula && Number.isFinite(totalKgNum) && totalKgNum > 0 && (
            <Stack spacing={0.5} sx={{ pl: 1 }}>
              {formula.ingredients.map((ing) => {
                const kg = (totalKgNum * ing.percentage) / 100;
                const stock =
                  findStockByArticle(stockItems, ing.articleKey)?.currentQuantity ?? 0;
                const lbl =
                  feedArticles.find((a) => a.articleKey === ing.articleKey)?.label ??
                  ing.articleKey;
                const rest = stock - kg;
                return (
                  <Typography
                    key={ing.articleKey}
                    variant="caption"
                    sx={{
                      fontFamily: "var(--font-mono)",
                      color: rest < 0 ? colors.warning.dark : colors.neutral[600],
                    }}
                  >
                    {lbl} — {formatQty(kg, "kg")} ({formatQty(stock, "kg")} →{" "}
                    {formatQty(rest, "kg")})
                  </Typography>
                );
              })}
            </Stack>
          )}
        </Stack>
      )}
    </Box>
  );
}
